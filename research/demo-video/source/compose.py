"""Builds the silent 30 s video: 7 x 1 s slides, then 23 s of the recorded demo with eased camera zooms."""
import json, subprocess, sys, bisect
import numpy as np, cv2

FPS, W, H = 30, 1920, 1080
SLIDES_S, DEMO_S = 7.0, 23.0
DSF = 1.5
out_path = sys.argv[1] if len(sys.argv) > 1 else 'silent.mp4'

tl = json.load(open('rec/timeline.json'))
ft = [f['t'] for f in tl['frames']]
cams = [e for e in tl['events'] if e['type'] == 'cam']

def ease(k):
    k = min(1.0, max(0.0, k))
    return 4 * k ** 3 if k < .5 else 1 - (-2 * k + 2) ** 3 / 2

def camera(t):
    z, cx, cy = 1.0, 960.0, 540.0
    for e in cams:
        if t < e['t']: break
        k = 1.0 if e['dur'] <= 0 else ease((t - e['t']) / e['dur'])
        z, cx, cy = z + (e['z'] - z) * k, cx + (e['cx'] - cx) * k, cy + (e['cy'] - cy) * k
    return z, cx, cy

cache = {}
def src(i):
    if i not in cache:
        if len(cache) > 6: cache.pop(next(iter(cache)))
        cache[i] = cv2.imread(f'rec/frames/{i:05d}.jpg')
    return cache[i]

order = sorted(range(len(ft)), key=lambda i: ft[i])   # a few frames arrive out of order
ft = [ft[i] for i in order]

def panel_blank(k):
    """True while the body panel is an empty sheet (the 3D figure repaints a beat after navigating back)."""
    img = cv2.imread(f'rec/frames/{order[k]:05d}.jpg', cv2.IMREAD_GRAYSCALE)
    return img[int(120 * DSF):int(560 * DSF), int(470 * DSF):int(660 * DSF)].std() < 2

# After the Body-nav click, hold the frame before the blank span until the figure is drawn.
clicks = [e for e in tl['events'] if e['type'] == 'click']
body_click = next(e['t'] for e in clicks if e['x'] == 204 and e['y'] == 28)
k = bisect.bisect_right(ft, body_click)
while k < len(ft) and not panel_blank(k): k += 1
hold_from = k - 1
hold_to = k
while hold_to < len(ft) and panel_blank(hold_to): hold_to += 1
print(f'body hold: {ft[hold_from]:.2f} -> {ft[hold_to]:.2f}s')

def demo_frame(t):
    k = max(0, bisect.bisect_right(ft, t) - 1)
    if hold_from < k < hold_to: k = hold_from
    i = order[k]
    img = src(i)
    z, cx, cy = camera(t)
    vw, vh = W / z, H / z
    cx = min(max(cx, vw / 2), W - vw / 2); cy = min(max(cy, vh / 2), H - vh / 2)
    x0, y0 = (cx - vw / 2) * DSF, (cy - vh / 2) * DSF
    s = W / (vw * DSF)                      # output px per source px
    f = min(1.0, s)                         # area-downsample first so the warp never minifies
    if f < 0.999:
        img = cv2.resize(img, (round(img.shape[1] * f), round(img.shape[0] * f)), interpolation=cv2.INTER_AREA)
        x0, y0, s = x0 * f, y0 * f, s / f
    M = np.float32([[s, 0, -x0 * s], [0, s, -y0 * s]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

slides = [cv2.imread(f'slides/s{i}.png') for i in range(1, 8)]
def slide_img(k, p):
    """slide k with a slow push-in, p in [0,1] over its second."""
    z = 1.0 + 0.035 * p
    M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, z)
    return cv2.warpAffine(slides[k], M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

XF = 4 / FPS          # slide-to-slide crossfade
XF_DEMO = 0.30        # slide 7 -> demo
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out_path], stdin=subprocess.PIPE)
total = int(round((SLIDES_S + DEMO_S) * FPS))
for n in range(total):
    t = n / FPS
    if t < SLIDES_S:
        k = int(t); p = t - k
        frame = slide_img(k, p)
        if k < 6 and p > 1 - XF:                      # blend into next slide
            a = (p - (1 - XF)) / XF
            frame = cv2.addWeighted(frame, 1 - a, slide_img(k + 1, 0.0), a, 0)
        if k == 6 and p > 1 - XF_DEMO:
            a = ease((p - (1 - XF_DEMO)) / XF_DEMO)
            frame = cv2.addWeighted(frame, 1 - a, demo_frame(0.0), a, 0)
    else:
        frame = demo_frame(t - SLIDES_S)
    ff.stdin.write(frame.tobytes())
    if n % 150 == 0: print('frame', n, '/', total, flush=True)
ff.stdin.close(); ff.wait()
print('wrote', out_path)
