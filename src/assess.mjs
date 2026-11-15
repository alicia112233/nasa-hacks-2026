import { checks } from './body.mjs';
import { analyze } from './rules.mjs';
import { isNumber, measuredAt, metricKeys } from './references.mjs';
import { LEVELS, lowPlan, lowRating, resultLine, symptomPlan, trendPlan, vitalPlan } from './guidance.mjs';

const rank = { watch: 0, tell: 1, now: 2 };

/** What each trend is called in a sentence. */
const NAME = { reactionMs: 'Response', leftRange: 'Left shoulder range', thighCm: 'Thigh breadth', exerciseMin: 'Exercise', heartRate: 'Resting heart rate', sleepHours: 'Sleep',
  sleep: 'Sleep quality', mood: 'Mood', energy: 'Energy', appetite: 'Appetite', workload: 'Workload', team: 'Teamwork' };
const round = v => String(Math.round(v * 10) / 10);
/**
 * A trend in plain words, with the medians it compares: "Mood down 1 point from your ghost (4/5 → 3/5)."
 * Ratings move in points, heart rate and sleep in their own unit, the rest in percent.
 */
function trendReason(check, change, ghost, now) {
  const name = NAME[check.field] ?? check.title;
  const size = round(Math.abs(change.amount));
  const unit = check.kind === 'scale' ? '/5' : check.unit === '°' ? '°' : check.unit ? ` ${check.unit}` : '';
  const values = `(${round(ghost)}${unit} → ${round(now)}${unit})`;
  if (change.by === 'points') return `${name} ${change.amount < 0 ? 'down' : 'up'} ${size} point${size === '1' ? '' : 's'} from your ghost ${values}.`;
  if (change.by === 'abs') return `${name} ${change.amount < 0 ? 'down' : 'up'} ${size}${unit} from your ghost ${values}.`;
  const word = check.field === 'reactionMs' ? (change.amount > 0 ? 'slower than' : 'faster than') : change.amount < 0 ? 'below' : 'above';
  return `${name} ${size}% ${word} your ghost ${values}.`;
}

/** One assessment supplies the concerns, urgency and next steps on every page. */
export function assess(checkIns, simulated, references = [], now = new Date().toISOString()) {
  const cutoff = Date.parse(now);
  // Daily entries can contain readings taken at different times. Historical views must not see later values.
  const records = checkIns.filter(r => r.simulated === simulated).map(r => {
    const copy = { ...r, measurements: { ...r.measurements } };
    for (const field of [...metricKeys, ...checks.map(c => c.field).filter(Boolean)]) {
      if (Date.parse(measuredAt(r, field)) > cutoff) {
        delete copy[field];
        delete copy.measurements[field];
      }
    }
    return copy;
  }).filter(r => Date.parse(r.date) <= cutoff || checks.some(c => isNumber(r[c.field])));
  const analysis = analyze(records, simulated, references.filter(r => Date.parse(r.establishedAt) <= cutoff));
  /** @type {import('./types').Concern[]} */
  const concerns = [];
  for (const check of checks.filter(c => c.field)) {
    const readings = analysis.records.filter(r => isNumber(r[check.field]) && r.measurements?.[check.field]?.quality !== 'poor')
      .sort((a, b) => measuredAt(a, check.field).localeCompare(measuredAt(b, check.field)));
    const last = readings.at(-1);
    if (!last) continue;
    const value = last[check.field], dia = check.field2 ? last[check.field2] : undefined;
    // A cuff result is a pair from the same measurement, never a systolic value on its own.
    if (check.field2 && (!isNumber(dia) || measuredAt(last, check.field) !== measuredAt(last, check.field2))) continue;
    const trend = analysis.trends[check.field]?.worse ?? false;
    const plans = [];
    if (trend) {
      const plan = trendPlan(check.field);
      if (plan) plans.push(plan);
    }
    if (check.kind === 'symptom') {
      const plan = symptomPlan(check.field, value);
      if (plan) plans.push(plan);
    }
    if (lowRating(check, value)) {
      const plan = lowPlan(check.field, value);
      if (plan) plans.push(plan);
    }
    const vital = vitalPlan(check, value, dia);
    if (vital) plans.push(vital);
    if (!plans.length) continue;
    plans.sort((a, b) => rank[b.level] - rank[a.level]);
    const level = plans[0].level;
    const seen = new Set(), steps = [];
    for (const plan of plans) for (const step of plan.steps) {
      if (seen.has(step.text) || steps.length >= 3) continue;
      seen.add(step.text);
      steps.push({ ...step, checkId: check.id });
    }
    let reason = trend
      ? trendReason(check, analysis.trends[check.field].change, analysis.baseline[check.field], analysis.current[check.field])
      : `${check.title}: ${resultLine(check, value, null, dia).text.replace(/^Today /, '')}.`;
    if (check.kind === 'symptom') reason = `Last report: ${check.title.toLowerCase()} (${check.options[value].toLowerCase()}).`;
    concerns.push({ checkId: check.id, field: check.field, region: check.region, title: check.title,
      trend, level, label: trend && level === 'watch' ? 'Alert' : LEVELS[level], reason, steps, measuredAt: measuredAt(last, check.field) });
  }
  concerns.sort((a, b) => rank[b.level] - rank[a.level]);
  return { analysis, concerns };
}
