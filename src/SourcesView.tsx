import { useState } from 'react';
import { ArrowUpRight, Download } from 'lucide-react';
import { researchSources } from './research.mjs';
import { downloadFile } from './data';
import { useEda } from './NasaData';
interface Props {
  onRestore: () => void;
  onDeleteAll: () => Promise<void>;
}

/** Where the numbers come from: the records shown on this device, and the NASA and CSA sources behind every check. */
export default function SourcesView({ onRestore, onDeleteAll }: Props) {
  const { data } = useEda();
  const [confirm, setConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  async function clear() {
    setClearing(true);
    setClearError('');
    try {
      await onDeleteAll();
      setConfirm(false);
    } catch {
      setClearError('Could not delete the records. Check device storage and try again.');
    } finally {
      setClearing(false);
    }
  }

  return <div className="page-grid sources-page">
    <section className="sheet">
      <h2>Data</h2>
      <p className="muted">Everything stays on this device. Alex, Jordan, Mei and Diego come with 14 sols of history; members you add start empty.</p>
      <button className="link" onClick={onRestore}>Restore sample crew</button>
      <div className="danger">
        {confirm ? <><span>Delete every crew member, reading, video and scan on this device? The sample crew comes back. Downloaded files must be deleted separately.</span><button className="btn danger-btn" disabled={clearing} onClick={() => void clear()}>{clearing ? 'Deleting…' : 'Delete everything'}</button><button className="link" onClick={() => setConfirm(false)}>Cancel</button></>
          : <button className="btn outline-danger" onClick={() => setConfirm(true)}>Delete all records</button>}
        {clearError && <p className="error" role="alert">{clearError}</p>}
      </div>
    </section>

    <section className="sheet">
      <h2>Sources <small>{researchSources.length + 1}</small></h2>
      <ul className="sources">
        {data && <li><a href={data.source.portal} target="_blank" rel="noreferrer">NASA EDA · {data.mission} habitat and radiation<ArrowUpRight size={12}/></a><small>Imported · retrieved {data.source.retrievedAt.slice(0, 10)} · sha256 {data.source.sha256.slice(0, 12)}</small></li>}
        {researchSources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.agency} · {s.title}<ArrowUpRight size={12}/></a></li>)}
      </ul>
      <button className="btn ghost" onClick={() => downloadFile('ghostpilot-sources.json', JSON.stringify({ sources: researchSources, nasaData: data?.source ?? null }, null, 2), 'application/json')}><Download size={16}/> Source list</button>
    </section>
  </div>;
}
