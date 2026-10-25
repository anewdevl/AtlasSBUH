import type { ResearchReport } from '../lib/research-contracts';
import { normalizedName } from '../lib/business-shortlist';
import { categories } from '../lib/categories';

export default function BusinessShortlist({ report }: { report: ResearchReport }) {
  const entries = report.shortlist;
  function card(b: typeof entries[number], index: number) {
    const observations = report.findings.filter(f => f.business && normalizedName(f.business) === normalizedName(b.name));
    return <article key={b.id} className="shortlist-card"><div className="shortlist-title"><span className="shortlist-rank">{index + 1}</span><div><h4>{b.name}</h4><p>{categories[b.categoryId].label} · {Math.round(b.distanceMeters)} m straight-line distance</p></div><strong>{b.rankScore.toFixed(1)}<small>/100 match</small></strong></div><p>{b.matchReason}</p><p className="micro">Relevance {b.relevanceScore}/100 · {b.positionKind === 'representative-center' ? 'Mapped building/area center; entrance may differ.' : 'Mapped point.'} <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">Map evidence ↗</a></p>
      {observations.length ? <details><summary>{observations.length} supported web observations · branch match unconfirmed</summary>{observations.map(f => <div key={f.id} className="shortlist-observation"><strong>{f.kind === 'feedback' ? 'Retrieved commentary' : f.kind}</strong>{f.evidence.map((ref, i) => <div key={i}><blockquote>{ref.quote}</blockquote><a href={`#research-source-${ref.sourceId}`}>{report.evidence.find(e => e.id === ref.sourceId)?.title ?? 'Source'}</a></div>)}</div>)}<p className="micro">Web material can describe the whole brand or another branch. Commentary is not a representative customer survey.</p></details> : <p className="micro">Mapped candidate; no verified web details in this run.</p>}
    </article>;
  }
  return <section aria-label="Ranked local shortlist"><h3>Your local shortlist</h3><div className="research-summary"><strong>{entries.length} named mapped features</strong><span>Within {report.request.scope.radiusMeters} m · 80% relevance / 20% proximity</span><span>{report.findings.length} checked web observations · {report.insights.length} proposed next steps</span></div><p>Rank reflects the confirmed category and matching business terms, weighted ahead of distance. It is not a rating of business quality. Web research covers up to three distinct names; map coverage and duplicate identities remain uncertain.</p>{entries.slice(0, 3).map(card)}{entries.length > 3 && <details><summary>Show all {entries.length} mapped candidates</summary>{entries.slice(3).map((b, i) => card(b, i + 3))}</details>}</section>;
}
