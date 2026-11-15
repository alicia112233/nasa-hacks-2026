import { domainOf, regions } from './body.mjs';
import { LEVELS, nextSteps, resultLine } from './guidance.mjs';

/**
 * The day at a glance, from the region statuses on screen: every self-check grouped into physical and mental, each
 * done, off (done, but trending or outside its range) or still to do. These are today's checks, not a health score.
 * @param {Record<string, { items: any[] }>} statuses @param {Record<string, number | null>} ghost
 */
export function daySummary(statuses, ghost = {}) {
  const rows = regions.flatMap(region => statuses[region.id].items.filter(i => i.check.field).map(i => {
    const g = i.comparison?.comparable ? ghost[i.check.field] ?? null : null;
    const result = i.done && i.value != null ? resultLine(i.check, i.value, g) : null;
    const state = !i.done ? 'todo' : i.flagged || result?.level === 'watch' ? 'off' : 'done';
    return { region, check: i.check, item: i, domain: domainOf(i.check), state, result, ghost: g };
  }));
  const side = domain => {
    const list = rows.filter(r => r.domain === domain);
    return { rows: list, done: list.filter(r => r.state !== 'todo').length, total: list.length,
      trends: list.filter(r => r.item.flagged).map(r => r.check.title), reported: list.filter(r => r.item.reported).map(r => r.check.title),
      next: list.find(r => r.state === 'todo') ?? null };
  };
  const physical = side('physical'), mental = side('mental');
  // What needs attention, with the same urgency label and first step a region card gives that reading on its own.
  const attention = regions.flatMap(region => statuses[region.id].items.filter(i => i.flagged || i.reported).map(i => {
    const guide = nextSteps([i]);
    return { region, check: i.check, label: i.flagged ? 'Trend' : guide ? LEVELS[guide.level] : 'Reported', urgent: guide?.level === 'now', step: guide?.steps[0]?.text ?? null };
  }));
  const notMeasured = regions.flatMap(region => region.checks.filter(c => c.kind === 'instrument').map(c => ({ region, check: c })));
  return { rows, physical, mental, attention, notMeasured, done: physical.done + mental.done, total: physical.total + mental.total };
}

/** The first region, in body order, that still has a check to do today. */
export const nextRegion = (statuses, after) => {
  const order = regions.filter(r => statuses[r.id].items.some(i => i.check.field && !i.done));
  return order.find(r => r.id !== after) ?? null;
};
