'use client';
import { compare } from '../lib/compare';
import { areaStats, describeChange } from '../lib/compare-stats';
import { cities } from '../lib/cities';
import { categories } from '../lib/categories';
import type { AnalysisResponse } from '../lib/contracts';

type Row = { label: string; a: number; b: number; format?: (n: number) => string };

function Bars({ row }: { row: Row }) {
  const fmt = row.format ?? (n => String(n));
  const max = Math.max(row.a, row.b, 1);
  return (
    <div className="compare-row">
      <div className="compare-label">{row.label}</div>
      <div className="compare-bars">
        {([['Pinned', row.a, 'pinned'], ['Current', row.b, 'current']] as const).map(([who, value, cls]) => (
          <div className="compare-bar" key={who}>
            <span className="compare-who">{who}</span>
            <span className="compare-track" aria-hidden="true"><i className={cls} style={{ width: `${(value / max) * 100}%` }} /></span>
            <strong>{fmt(value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComparePanel({ a, b, onClear }: { a: AnalysisResponse; b: AnalysisResponse | null; onClear: () => void }) {
  const comparison = compare(a, b);
  const place = (r: AnalysisResponse) => `${cities[r.request.scope.cityId].label} · ${r.request.scope.center.lat}, ${r.request.scope.center.lon}`;
  return (
    <section className="comparison" aria-label="Area comparison">
      <div className="section-heading">
        <div>
          <div className="eyebrow">SIDE BY SIDE</div>
          <h2>Compare two areas</h2>
        </div>
        <button className="text-button" onClick={onClear}>Clear pin</button>
      </div>
      <p className="muted">Pinned: {place(a)} · {categories[a.request.categoryId].label}, {a.request.scope.radiusMeters / 1000} km. Analyze another area with the same settings to compare.</p>
      {!comparison.comparable ? <p role="status" className="notice">{comparison.reason}</p> : (() => {
        const sa = areaStats(comparison.a), sb = areaStats(comparison.b);
        const rows: Row[] = [
          { label: 'Direct competitors', a: sa.direct, b: sb.direct },
          { label: 'Per km²', a: sa.density, b: sb.density, format: n => n.toFixed(1) },
          { label: 'Adjacent businesses', a: sa.adjacent, b: sb.adjacent },
          { label: 'Chain share', a: sa.chainShare, b: sb.chainShare, format: n => `${n}%` },
        ];
        return (
          <>
            <div className="compare-grid">
              {[['PINNED AREA', comparison.a], ['CURRENT AREA', comparison.b]].map(([title, r]) => (
                <div key={title as string}>
                  <span className="eyebrow">{title as string}</span>
                  <h3>{cities[(r as AnalysisResponse).request.scope.cityId].label}</h3>
                  <p className="micro">{(r as AnalysisResponse).request.scope.center.lat}, {(r as AnalysisResponse).request.scope.center.lon}</p>
                  <p className="micro">{new Date((r as AnalysisResponse).provenance.fetchedAt).toLocaleDateString()} · {(r as AnalysisResponse).provenance.cacheState}</p>
                </div>
              ))}
            </div>
            <div className="compare-rows">{rows.map(row => <Bars key={row.label} row={row} />)}</div>
            <ul className="compare-notes">
              <li>{describeChange('direct competitors per km²', sa.density, sb.density)}</li>
              <li>Chain share is {sa.chainShare}% in the pinned area and {sb.chainShare}% in the current area.</li>
            </ul>
            <div className="compare-names">
              {[['Pinned', sa], ['Current', sb]].map(([who, s]) => (
                <div key={who as string}>
                  <h4>{who as string}: repeated names</h4>
                  {(s as typeof sa).repeatedNames.length
                    ? <p>{(s as typeof sa).repeatedNames.map(n => `${n.name} (${n.count})`).join(', ')}</p>
                    : <p className="micro">No name appears more than once.</p>}
                </div>
              ))}
            </div>
            <p className="micro">Same radius and category. Mapping coverage and retrieval dates may differ. These measures describe competition, not demand, and do not recommend a winner.</p>
          </>
        );
      })()}
    </section>
  );
}