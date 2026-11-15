import type { CarePlan } from './types';

export const blankCarePlan = (): CarePlan => ({ procedure: { status: 'unknown', name: '', version: '' }, nextCheck: '', dueAt: '', missingInformation: [] });
const localInput = (iso: string) => iso ? new Date(Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

export default function CarePlanFields({ plan, onChange }: { plan: CarePlan; onChange: (plan: CarePlan) => void }) {
  return <div className="care-plan-fields">
    <label className="field">Procedure followed<select aria-label="Procedure followed" value={plan.procedure.status} onChange={e => onChange({ ...plan, procedure: { ...plan.procedure, status: e.target.value as CarePlan['procedure']['status'] } })}><option value="unknown">Not recorded / unknown</option><option value="none">None followed</option><option value="followed">Record procedure and version</option></select></label>
    {plan.procedure.status === 'followed' && <div className="context-fields">
      <label className="field">Procedure name<input required maxLength={200} value={plan.procedure.name} onChange={e => onChange({ ...plan, procedure: { ...plan.procedure, name: e.target.value } })}/></label>
      <label className="field">Procedure version<input required maxLength={100} placeholder="Enter unknown if unavailable" value={plan.procedure.version} onChange={e => onChange({ ...plan, procedure: { ...plan.procedure, version: e.target.value } })}/></label>
    </div>}
    <div className="context-fields">
      <label className="field">What needs checking again<input required maxLength={300} placeholder="e.g. vision change under the same lighting" value={plan.nextCheck} onChange={e => onChange({ ...plan, nextCheck: e.target.value })}/></label>
      <label className="field">Reassess at<input required type="datetime-local" value={localInput(plan.dueAt)} onChange={e => onChange({ ...plan, dueAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}/></label>
    </div>
    <p className="muted">Choose timing from the onboard procedure or medical lead’s instructions. GhostPilot does not prescribe a reassessment interval.</p>
    <label className="field">Information still missing<textarea aria-label="Information still missing" required maxLength={1000} rows={2} placeholder="One item per line, or explicitly enter None identified" value={plan.missingInformation.join('\n')} onChange={e => onChange({ ...plan, missingInformation: e.target.value.split('\n') })}/></label>
  </div>;
}
