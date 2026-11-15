import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const columns = ['participant_id', 'session_id', 'camera', 'lighting', 'clothing', 'posture', 'target', 'metric', 'attempt', 'measured_at', 'app_value', 'reference_value', 'reference_method', 'status', 'failure_reason'];
const methods = { shoulder_left_deg: 'goniometer_included_angle', thigh_breadth_cm: 'caliper_bilateral_band_mean' };
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const sd = xs => xs.length > 1 ? Math.sqrt(xs.reduce((sum, x) => sum + (x - mean(xs)) ** 2, 0) / (xs.length - 1)) : null;
const grouped = (rows, key) => { const out = new Map(); for (const row of rows) { const k = key(row); if (!out.has(k)) out.set(k, []); out.get(k).push(row); } return out; };

/** CSV including quoted fields/newlines. Blank rows never become zero-valued measurements. */
export function parseAttempts(csv) {
  const table = []; let row = [], field = '', quoted = false;
  const input = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') { if (quoted && input[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && c === ',') { row.push(field); field = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) { if (c === '\r' && input[i + 1] === '\n') i++; row.push(field); if (row.some(v => v.trim())) table.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  if (field || row.length) { row.push(field); if (row.some(v => v.trim())) table.push(row); }
  if (!table.length || columns.some((name, i) => table[0][i]?.trim() !== name) || table[0].length !== columns.length) throw new Error('Use the supplied attempts.csv columns in their original order.');
  return table.slice(1).map((values, i) => {
    if (values.length !== columns.length) throw new Error(`Row ${i + 2}: expected ${columns.length} columns.`);
    return Object.fromEntries(columns.map((key, j) => [key, values[j].trim()]));
  });
}

function validate(rows) {
  const seen = new Set();
  return rows.map((raw, i) => {
    const row = { ...raw };
    const fail = reason => { throw new Error(`Row ${i + 2}: ${reason}`); };
    for (const c of columns.filter(k => !['app_value', 'reference_value', 'failure_reason'].includes(k))) if (!row[c]) fail(`${c} is required.`);
    if (!/^P\d{2,}$/.test(row.participant_id)) fail('Use a pseudonymous participant_id such as P01.');
    if (!Object.hasOwn(methods, row.metric) || row.reference_method !== methods[row.metric]) fail('Metric and matching reference method must follow the study protocol.');
    if (!['success', 'failed'].includes(row.status)) fail('status must be success or failed.');
    if (!/^\d+$/.test(row.attempt) || Number(row.attempt) < 1) fail('attempt must be a positive integer.');
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(row.measured_at) || !Number.isFinite(Date.parse(row.measured_at))) fail('measured_at needs an ISO timestamp with timezone.');
    for (const key of ['app_value', 'reference_value']) {
      row[key] = row[key] === '' ? null : Number(row[key]);
      const max = row.metric === 'shoulder_left_deg' ? 180 : 80;
      if (row[key] != null && (!Number.isFinite(row[key]) || row[key] < 0 || row[key] > max || (row.metric === 'thigh_breadth_cm' && row[key] === 0))) fail(`${key} is outside the metric range.`);
    }
    if (row.status === 'success' && row.app_value == null) fail('A successful attempt needs an app_value; missing is not zero.');
    if (row.status === 'failed' && !row.failure_reason) fail('Retain a failure reason for every failed attempt.');
    const identity = JSON.stringify(['participant_id', 'session_id', 'camera', 'lighting', 'clothing', 'posture', 'target', 'metric', 'attempt'].map(k => row[k]));
    if (seen.has(identity)) fail('Duplicate attempt; do not count the same capture twice.'); seen.add(identity);
    return row;
  });
}

function describe(rows) {
  const successes = rows.filter(r => r.status === 'success');
  const paired = successes.filter(r => r.reference_value != null);
  const errors = paired.map(r => r.app_value - r.reference_value);
  const perPerson = [...grouped(paired, r => r.participant_id)].map(([, values]) => mean(values.map(r => r.app_value - r.reference_value)));
  return { attempts: rows.length, participants: new Set(rows.map(r => r.participant_id)).size, failures: rows.length - successes.length,
    failureRate: rows.length ? (rows.length - successes.length) / rows.length : null, paired: paired.length, successfulWithoutReference: successes.length - paired.length,
    meanAbsoluteError: mean(errors.map(Math.abs)), rootMeanSquaredError: errors.length ? Math.sqrt(mean(errors.map(x => x * x))) : null,
    captureWeightedBias: mean(errors), participantWeightedBias: mean(perPerson), maxAbsoluteError: errors.length ? Math.max(...errors.map(Math.abs)) : null };
}

/** Descriptive pilot statistics; repeated captures are not independent participants. */
export function analyzeStudy(rawRows) {
  const rows = validate(rawRows);
  const metrics = Object.fromEntries(Object.keys(methods).map(metric => {
    const own = rows.filter(r => r.metric === metric), good = own.filter(r => r.status === 'success');
    const conditionKey = r => JSON.stringify([r.participant_id, r.camera, r.lighting, r.clothing, r.posture, r.target]);
    const repeats = [...grouped(good, r => JSON.stringify([conditionKey(r), r.session_id]))].filter(([, group]) => group.length > 1).map(([group, values]) => ({ group, captures: values.length, appSD: sd(values.map(r => r.app_value)), errorSD: sd(values.filter(r => r.reference_value != null).map(r => r.app_value - r.reference_value)) }));
    const sessions = [...grouped(good, conditionKey)].map(([group, values]) => {
      const summaries = [...grouped(values, r => r.session_id)].map(([session, captures]) => ({ session, mean: mean(captures.map(r => r.app_value)) }));
      return { group, sessions: summaries, sessionMeanRange: summaries.length > 1 ? Math.max(...summaries.map(r => r.mean)) - Math.min(...summaries.map(r => r.mean)) : null };
    }).filter(r => r.sessions.length > 1);
    const by = Object.fromEntries(['camera', 'lighting', 'clothing', 'session_id'].map(key => [key, Object.fromEntries([...grouped(own, r => r[key])].map(([name, captures]) => [name, describe(captures)]))]));
    return [metric, { unit: metric === 'shoulder_left_deg' ? 'degrees' : 'cm', ...describe(own), withinSessionRepeatability: repeats, betweenSessionMeans: sessions, by }];
  }));
  return { schemaVersion: 1, status: rows.length ? 'Pilot observations — not clinical validation' : 'PENDING — no real-participant attempts collected', realParticipants: new Set(rows.map(r => r.participant_id)).size,
    totalAttempts: rows.length, metrics, failedCaptures: rows.filter(r => r.status === 'failed'),
    limitations: ['No acceptability threshold, clinical accuracy or spaceflight validity is established by this report.', 'MAE/RMSE describe successful paired captures only; failure rates include every logged attempt.', 'Repeated captures are correlated. No confidence interval, ICC or population limits of agreement are inferred.', 'Within-session groups require the same participant, camera, lighting, clothing, posture and target; between-session ranges are descriptive.', 'Within-scan frame scatter is not between-session repeatability or accuracy on people.'] };
}

export function studyMarkdown(report) {
  const show = v => v == null ? 'Not available' : v.toFixed(3);
  return `# GhostPilot real-participant pilot\n\n${report.status}\n\nParticipants: ${report.realParticipants}. Attempts: ${report.totalAttempts}.\n\n| Metric | Attempts | Failed | Paired | MAE | RMSE | Participant-weighted bias |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${Object.entries(report.metrics).map(([name, m]) => `| ${name} (${m.unit}) | ${m.attempts} | ${m.failures} | ${m.paired} | ${show(m.meanAbsoluteError)} | ${show(m.rootMeanSquaredError)} | ${show(m.participantWeightedBias)} |`).join('\n')}\n\nCamera, lighting, clothing, session breakdowns and repeatability groups are included in the companion JSON.\n\n## Failed captures\n${report.failedCaptures.map(r => `- ${r.participant_id}/${r.session_id}, ${r.metric}, attempt ${r.attempt}: ${r.failure_reason}`).join('\n') || 'No failed attempts logged; this is not evidence that captures cannot fail.'}\n\n## Limits\n${report.limitations.map(v => `- ${v}`).join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const input = resolve(process.argv[2] ?? 'research/human-study/attempts.csv');
    const output = resolve(process.argv[3] ?? join(dirname(input), `${basename(input, '.csv')}-report`));
    if ([`${output}.json`, `${output}.md`].includes(input)) throw new Error('Report output cannot overwrite the input.');
    const report = analyzeStudy(parseAttempts(await readFile(input, 'utf8')));
    await writeFile(`${output}.json`, JSON.stringify(report, null, 2) + '\n');
    await writeFile(`${output}.md`, studyMarkdown(report));
    console.log(`${report.status}\nReports: ${output}.json and .md`);
  } catch (err) { console.error(err.message); process.exitCode = 1; }
}
