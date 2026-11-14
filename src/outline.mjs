/**
 * The scanned outline as a solid: the person mask from the body scan, given depth.
 *
 * One front view holds no depth, so the depth here is estimated, not measured. The outline is inflated the way a
 * balloon cut to that shape would fill: solve the Poisson equation (laplacian u = -1) inside the outline with u = 0
 * on its edge, and take sqrt(2u) as the half-depth. A long strip then gets a round cross-section, so a limb comes
 * out as thick as it is wide. A torso is flatter than it is wide, so the half-depth is eased toward a ceiling set
 * as a share of the outline's height. The back mirrors the front. Nothing here knows about faces, clothes or the
 * side view; it is the outline that was scanned, and no more.
 *
 * Kept free of the DOM and of Three.js so it runs in Node tests.
 */

/** Half-depth ceiling as a share of the outline's height: an adult chest is about 14% of stature deep. */
export const DEPTH = 0.07;

/**
 * @param {ArrayLike<number>} mask person confidence per pixel, row major (a mean of the scan's usable frames)
 * @param {number} width
 * @param {number} height
 * @param {{ step?: number, threshold?: number, depth?: number, mirror?: boolean }} [options] step: pixels per grid cell;
 *   depth: half-depth ceiling as a share of the outline's height (Infinity leaves the balloon shape alone);
 *   mirror: flip left and right, to match a mirrored camera preview
 * @returns {null | { positions: Float32Array, index: Uint32Array, scale: number, aspect: number, depth: number }}
 *   positions: x right, y up from the feet, z toward the viewer, in units of the outline's height;
 *   scale: that height in pixels; aspect: outline width / height; depth: front-to-back thickness at its thickest
 */
export function inflateOutline(mask, width, height, { step = 2, threshold = 0.5, depth = DEPTH, mirror = true } = {}) {
  // Bounding box of everything above the threshold, then a grid over it with a clear margin all round.
  let x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x] >= threshold) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const PAD = 2, gw = Math.ceil((x1 - x0 + 1) / step) + 2 * PAD + 1, gh = Math.ceil((y1 - y0 + 1) / step) + 2 * PAD + 1;
  const ox = x0 - PAD * step, oy = y0 - PAD * step, N = gw * gh;
  // Each grid point takes the mean confidence of its step x step block, which also softens the mask's stair steps.
  const value = new Float32Array(N);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let sum = 0;
    for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
      const x = ox + gx * step + dx - (step >> 1), y = oy + gy * step + dy - (step >> 1);
      if (x >= 0 && y >= 0 && x < width && y < height) sum += mask[y * width + x];
    }
    value[gy * gw + gx] = sum / (step * step);
  }

  // Keep the largest connected piece: a chair or a second person in the frame is not part of the scan.
  const label = new Int32Array(N), stack = [];
  let best = 0, bestSize = 0;
  for (let start = 0, next = 1; start < N; start++) {
    if (value[start] < threshold || label[start]) continue;
    let size = 0;
    label[start] = next; stack.push(start);
    while (stack.length) {
      const g = stack.pop(), gx = g % gw;
      size++;
      for (const n of [g - gw, g + gw, gx > 0 ? g - 1 : -1, gx < gw - 1 ? g + 1 : -1]) if (n >= 0 && n < N && !label[n] && value[n] >= threshold) { label[n] = next; stack.push(n); }
    }
    if (size > bestSize) { bestSize = size; best = next; }
    next++;
  }
  if (bestSize < 12) return null;
  const inside = g => label[g] === best;

  // The rim: outside points touching the piece (diagonals count, so every cell around an inside point is whole).
  // Each slides toward its inside neighbours to where the confidence crosses the threshold, which gives a smooth edge.
  const px = new Float32Array(N), py = new Float32Array(N), kind = new Uint8Array(N);
  for (let g = 0; g < N; g++) { px[g] = g % gw; py[g] = (g / gw) | 0; if (inside(g)) kind[g] = 1; }
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const g = gy * gw + gx;
    if (kind[g]) continue;
    let sx = 0, sy = 0, n = 0, diagonal = [0, 0, 0];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || gx + dx < 0 || gy + dy < 0 || gx + dx >= gw || gy + dy >= gh) continue;
      const o = g + dy * gw + dx;
      if (!inside(o)) continue;
      const cross = Math.min(0.95, Math.max(0, (threshold - value[g]) / (value[o] - value[g] || 1)));
      if (dx && dy) { diagonal[0] += dx * cross; diagonal[1] += dy * cross; diagonal[2]++; } else { sx += dx * cross; sy += dy * cross; n++; }
    }
    if (!n && !diagonal[2]) continue;
    kind[g] = 2;
    if (n) { px[g] += sx / n; py[g] += sy / n; } else { px[g] += diagonal[0] / diagonal[2]; py[g] += diagonal[1] / diagonal[2]; }
  }

  // Poisson by successive over-relaxation, in grid units: u = 0 on the rim, laplacian u = -1 inside.
  const u = new Float32Array(N), cells = [];
  for (let g = 0; g < N; g++) if (kind[g] === 1) cells.push(g);
  for (let it = 0; it < 800; it++) {
    let change = 0;
    for (const g of cells) {
      const d = ((u[g - 1] + u[g + 1] + u[g - gw] + u[g + gw] + 1) / 4 - u[g]) * 1.85;
      u[g] += d;
      if (Math.abs(d) > change) change = Math.abs(d);
    }
    if (change < 1e-3) break;
  }

  let top = gh, bottom = -1, left = gw, right = -1;
  for (let g = 0; g < N; g++) if (kind[g]) {
    if (py[g] < top) top = py[g]; if (py[g] > bottom) bottom = py[g]; if (px[g] < left) left = px[g]; if (px[g] > right) right = px[g];
  }
  const tall = bottom - top, ceiling = depth * tall, middle = (left + right) / 2;
  const half = g => { const z = Math.sqrt(2 * u[g]); return Number.isFinite(ceiling) ? ceiling * Math.tanh(z / ceiling) : z; };

  // Two sheets, front and back, that share the rim's points, so the solid is closed.
  const front = new Int32Array(N).fill(-1), back = new Int32Array(N).fill(-1), positions = [];
  let thickest = 0;
  const point = (g, z) => { positions.push((mirror ? -1 : 1) * (px[g] - middle) / tall, (bottom - py[g]) / tall, z / tall); return positions.length / 3 - 1; };
  for (let g = 0; g < N; g++) {
    if (kind[g] === 2) front[g] = back[g] = point(g, 0);
    else if (kind[g] === 1) { const z = half(g); if (z > thickest) thickest = z; front[g] = point(g, z); back[g] = point(g, -z); }
  }
  const index = [];
  // Seen from the front with y up, a counter-clockwise triangle faces the viewer; mirroring flips the turn.
  const face = (a, b, c, flip) => { if (a === b || b === c || a === c) return; if (flip) index.push(a, c, b); else index.push(a, b, c); };
  for (let gy = 0; gy < gh - 1; gy++) for (let gx = 0; gx < gw - 1; gx++) {
    const tl = gy * gw + gx, tr = tl + 1, bl = tl + gw, br = bl + 1;
    if (!kind[tl] || !kind[tr] || !kind[bl] || !kind[br]) continue;
    face(front[tl], front[bl], front[tr], mirror); face(front[tr], front[bl], front[br], mirror);
    face(back[tl], back[tr], back[bl], mirror); face(back[tr], back[br], back[bl], mirror);
  }
  if (!index.length) return null;
  return { positions: new Float32Array(positions), index: new Uint32Array(index), scale: tall * step, aspect: (right - left) / tall, depth: 2 * thickest / tall };
}

/** Volume enclosed by a triangle mesh (positive when its faces point outward), for checking a solid is closed and the right way out. */
export function meshVolume({ positions, index }) {
  let v = 0;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    v += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  return v / 6;
}
