'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResearchReport } from '../lib/research-contracts';
import { normalizedName } from '../lib/business-shortlist';
import MapPreviewDrawer from './MapPreviewDrawer';
import { categories } from '../lib/categories';
import type { AnalysisResponse } from '../lib/contracts';
import { insights, NEARBY_METERS } from '../lib/competitor-insights';

type Props = {
  competitor: AnalysisResponse['competitors'][number];
  /** Every competitor in the current analysis, used for rank and neighbor counts. */
  all: AnalysisResponse['competitors'];
  provenance: AnalysisResponse['provenance'];
  onClose: () => void;
  research: ResearchReport | null;
};

const yesNo: Record<string, string> = { yes: 'Yes', no: 'No', only: 'Takeaway only', limited: 'Limited' };

export default function CompetitorDetail({ competitor: c, all, provenance: p, onClose, research }: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const dismiss = useRef(onClose);
  dismiss.current = onClose;
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) dismiss.current(); };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  const info = useMemo(() => insights(c, all), [c, all]);
  const d = c.details;
  const facts: { label: string; value: React.ReactNode }[] = [];
  if (d?.address) facts.push({ label: 'Address', value: d.address });
  if (d?.openingHours) facts.push({ label: 'Hours', value: <code>{d.openingHours}</code> });
  if (d?.website) facts.push({ label: 'Website', value: <a href={d.website} target="_blank" rel="noopener noreferrer">{d.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')} ↗</a> });
  if (d?.phone) facts.push({ label: 'Phone', value: <a href={`tel:${d.phone.replace(/[^+\d]/g, '')}`}>{d.phone}</a> });
  if (d?.brand) facts.push({ label: 'Brand', value: d.brand });
  if (d?.cuisine) facts.push({ label: 'Cuisine', value: d.cuisine });
  if (d?.takeaway) facts.push({ label: 'Takeaway', value: yesNo[d.takeaway] });
  if (d?.outdoorSeating) facts.push({ label: 'Outdoor seating', value: yesNo[d.outdoorSeating] });
  if (d?.wheelchair) facts.push({ label: 'Wheelchair access', value: yesNo[d.wheelchair] });

  const sameName = info.sameNameOthers;
  const matched = research?.shortlist.some(b => b.id === c.sourceType+'/'+c.sourceId && b.name === c.name);
  const observations = matched && c.name ? research?.findings.filter(f => f.business && normalizedName(f.business) === normalizedName(c.name!)) ?? [] : [];
  return (
    <section className="competitor-detail" aria-label="Competitor details">
      <div className="detail-top">
        <span className="eyebrow">BUSINESS</span>
        <button ref={close} className="icon-button" aria-label="Close competitor details" onClick={onClose}>×</button>
      </div>
      <span className={`relation-label ${c.relation}`}><i className={`feature-dot ${c.relation}`} />{c.relation} competitor</span>
      <h2>{c.name ?? 'Unnamed mapped feature'}</h2>
      <p className="detail-category">{categories[c.categoryId].label}</p>

      <dl className="detail-stats" aria-label="How this business compares">
        <div><dt>Distance</dt><dd>{Math.round(c.distanceMeters)}<small> m</small></dd><span>from the search center</span></div>
        <div><dt>Closeness</dt><dd>#{info.rank}<small> of {info.total}</small></dd><span>{info.rank === 1 ? 'closest to the center' : 'by distance to the center'}</span></div>
        <div><dt>Rivals next door</dt><dd>{info.rivalsNearby}</dd><span>within {NEARBY_METERS} m</span></div>
        <div><dt>Same name</dt><dd>{sameName === 0 ? '—' : sameName + 1}</dd><span>{sameName === 0 ? 'no repeated name here' : `locations in this area`}</span></div>
      </dl>
      {info.nearestRival && <p className="detail-nearest">Closest rival: <strong>{info.nearestRival.name}</strong>, {Math.round(info.nearestRival.meters)} m away.</p>}

      <div className="detail-section">
        <h3>About this place</h3>
        {facts.length > 0
          ? <dl className="detail-facts">{facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
          : <p className="micro">No address, hours, or website is recorded for this place in the data we have.</p>}
        <a className="source-link" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">View {c.sourceType}/{c.sourceId} on OpenStreetMap ↗</a>
      </div>

      <div className="detail-section"><button className="secondary" onClick={() => setMapOpen(true)}>Open mini map</button></div>
      {mapOpen && <MapPreviewDrawer input={{ name: c.name, address: d?.address, coordinates: c.coordinates }} onClose={() => setMapOpen(false)} />}
      {observations.length > 0 && <details className="detail-source"><summary>Research observations</summary><p className="micro">Exact branch identity is unconfirmed.</p>{observations.map(f => <details key={f.id}><summary>{f.kind}: {f.claim}</summary>{f.evidence.map((ref, index) => { const source = research?.evidence.find(e => e.id === ref.sourceId); return source && <div key={index}><blockquote>{ref.quote}</blockquote><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></div>; })}</details>)}</details>}
      <details className="detail-source">
        <summary>Source data</summary>
        <p className="mono">{c.coordinates.lat.toFixed(5)}, {c.coordinates.lon.toFixed(5)}</p>
        <p className="micro">{c.positionKind === 'representative-center' ? 'Center of a mapped area. This may not be the entrance.' : 'Mapped point location. Entrance accuracy is not verified.'}</p>
        <div className="evidence-tags">{Object.entries(c.evidence).map(([key, value]) => <code key={key}>{key}={value}</code>)}</div>
        <p className="micro">{c.sourceType}/{c.sourceId} · retrieved {new Date(p.fetchedAt).toLocaleDateString()} · {p.cacheState}</p>
        <a href={p.licenseLink} target="_blank" rel="noopener noreferrer">{p.attribution} · ODbL</a>
      </details>
    </section>
  );
}
