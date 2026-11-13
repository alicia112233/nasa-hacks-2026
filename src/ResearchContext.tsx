import { ArrowUpRight, BookOpen, Download, Link2 } from 'lucide-react';
import { dataResources, foundationSources, researchSources, researchUse, sourcesForHazard } from './research.mjs';
import { downloadFile } from './data';
import type { HazardId } from './types';
import './research.css';

export function HazardResearch({ hazard }: { hazard: HazardId }) {
  return <details className="hazard-research" key={hazard}>
    <summary><BookOpen size={15} aria-hidden="true"/> Research for this hazard</summary>
    <p>Published research explains the context. It does not validate your measurements or the prototype’s thresholds.</p>
    <ul>{sourcesForHazard(hazard).map(source => source && <li key={source.id}>
      <a href={source.url} target="_blank" rel="noreferrer">{source.agency}: {source.title} <ArrowUpRight size={13} aria-hidden="true"/></a>
      <p>{source.role}</p>
    </li>)}</ul>
  </details>;
}

export default function ResearchContext() {
  return <section className="lens-research" aria-labelledby="research-title">
    <div className="lens-research-title"><div><span className="eyebrow"><BookOpen size={13} aria-hidden="true"/> RESEARCH & RESOURCES</span><h2 id="research-title">Science behind the perspective.</h2></div><span>NASA & CSA primary sources<br/>Reviewed 14 November 2026</span></div>
    <div className="research-cards">{foundationSources.map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
      <span>{source.agency} / BACKGROUND <ArrowUpRight size={16} aria-hidden="true"/></span><h3>{source.title}</h3><p>{source.role}</p><span className="research-link"><Link2 size={12} aria-hidden="true"/> Read the primary source</span>
    </a>)}</div>
    <details className="research-data"><summary>Explore NASA data sources <span>4 catalogs and archives</span></summary>
      <p>External archives need an internet connection. Their measurements stay separate from your history; no external readings are imported.</p>
      <div className="research-data-grid">{dataResources.map(source => <article key={source.id}>
        <span className="research-access">{source.access}</span><h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} <ArrowUpRight size={14} aria-hidden="true"/></a></h3>
        <p>{source.role}</p><p className="research-limit">{source.limitation}</p>
      </article>)}</div>
    </details>
    <div className="research-provenance"><p>This map does not calculate a clinical risk score. NASA and CSA resources inform its context; thresholds and reflection cards are independent, unvalidated prototype choices. Source notes remain available offline after the app is cached.</p>
      <button className="button secondary" onClick={() => downloadFile('ghostpilot-research-sources.json', JSON.stringify({ research: researchUse, sources: researchSources }, null, 2), 'application/json')}><Download size={14} aria-hidden="true"/> Download source list</button>
    </div>
  </section>;
}
