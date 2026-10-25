'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { type Position } from '../lib/cities';
import { categories } from '../lib/categories';
import { competitorId, type Competitor } from '../lib/competitor-view';

type Props = {
  center: Position;
  radius: number;
  competitors: Competitor[];
  selectedId: string | null;
  selectionTick: number;
  onSelect: (id: string) => void;
  onNavigate: () => void;
  onCenter: (p: Position) => void;
};

// Below this zoom, nearby businesses are grouped into numbered clusters.
// At this zoom and closer, every business is its own marker (and the overlap
// picker below handles features that share almost the same spot).
const UNCLUSTER_ZOOM = 18;

function clusterIcon(cluster: L.MarkerCluster) {
  const children = cluster.getAllChildMarkers();
  const count = children.length;
  const allAdjacent = children.every(m => String((m.options as L.CircleMarkerOptions).className ?? '').includes('adjacent'));
  const size = count < 10 ? 'small' : count < 50 ? 'medium' : 'large';
  return L.divIcon({
    html: `<span>${count}</span>`,
    className: `atlas-cluster atlas-cluster-${size}${allAdjacent ? ' adjacent' : ''}`,
    iconSize: L.point(size === 'small' ? 34 : size === 'medium' ? 42 : 52, size === 'small' ? 34 : size === 'medium' ? 42 : 52),
  });
}

export default function MapCanvas({ center, radius, competitors, selectedId, selectionTick, onSelect, onNavigate, onCenter }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const cluster = useRef<L.MarkerClusterGroup | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const callback = useRef(onCenter);
  const select = useRef(onSelect);
  const selected = useRef<string | null>(selectedId);
  const [tilesFailed, setTilesFailed] = useState(false);
  callback.current = onCenter;
  select.current = onSelect;
  selected.current = selectedId;

  function padding(withDetails = false) {
    const m = map.current!;
    const size = m.getSize();
    const mobile = matchMedia('(max-width:760px)').matches;
    const panel = withDetails ? host.current?.parentElement?.querySelector('.competitor-detail')?.getBoundingClientRect() : null;
    const rect = host.current!.getBoundingClientRect();
    const coveredBottom = mobile && panel ? Math.max(0, rect.bottom - panel.top) : 0;
    return {
      paddingTopLeft: L.point(24, Math.min(160, size.y * 0.3)),
      paddingBottomRight: L.point(panel && !mobile ? Math.min(panel.width + 48, size.x * 0.65) : 40, Math.min(coveredBottom + 60, size.y * 0.65)),
    };
  }

  function navigate(kind: 'center' | 'results') {
    const m = map.current;
    if (!m) return;
    m.stop();
    m.closePopup();
    onNavigate();
    m.invalidateSize({ pan: false });
    const bounds = kind === 'results' && competitors.length
      ? L.latLngBounds(competitors.map(c => [c.coordinates.lat, c.coordinates.lon] as L.LatLngTuple))
      : L.latLng(center.lat, center.lon).toBounds(radius * 2);
    m.fitBounds(bounds, { ...(kind === 'center' ? { padding: L.point(64, 64) } : padding()), maxZoom: 17, animate: false });
  }

  // 1. Create the map once.
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, { zoomControl: false, fadeAnimation: false }).setView([center.lat, center.lon], 14);
    map.current = m;
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.tileLayer(process.env.NEXT_PUBLIC_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).on('tileerror', () => setTilesFailed(true)).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    cluster.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false, // never move a business away from its recorded coordinates
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: UNCLUSTER_ZOOM,
      maxClusterRadius: 48,
      chunkedLoading: true,
      iconCreateFunction: clusterIcon,
    }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => callback.current({ lat: e.latlng.lat, lon: e.latlng.lng }));
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
      cluster.current = null;
    };
    // Initial creation is separate from scope and selection updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Re-center when the search center changes.
  useEffect(() => {
    const m = map.current;
    if (m) {
      m.stop();
      m.invalidateSize({ pan: false });
      m.setView([center.lat, center.lon], m.getZoom(), { animate: false });
    }
  }, [center.lat, center.lon]);

  // 3. Rebuild the search circle and the clustered business markers.
  useEffect(() => {
    if (!layer.current || !map.current || !cluster.current) return;
    const group = layer.current;
    const clusters = cluster.current;
    const m = map.current;
    m.closePopup();
    group.clearLayers();
    clusters.clearLayers();
    markers.current.clear();

    function focusMarker(marker?: L.CircleMarker) {
      const el = marker?.getElement();
      if (el instanceof SVGElement || el instanceof HTMLElement) el.focus();
    }
    function choose(id: string) {
      m.closePopup();
      focusMarker(markers.current.get(id)); // remember the trigger so Escape can restore focus
      select.current(id);
    }
    function activate(id: string) {
      const clicked = markers.current.get(id);
      if (!clicked) return;
      clicked.closeTooltip();
      const point = m.latLngToContainerPoint(clicked.getLatLng());
      const nearby = competitors.filter(c => m.latLngToContainerPoint([c.coordinates.lat, c.coordinates.lon]).distanceTo(point) <= 18);
      if (nearby.length < 2) {
        choose(id);
        return;
      }
      const content = document.createElement('section');
      const heading = document.createElement('strong');
      const hint = document.createElement('p');
      content.setAttribute('aria-label', 'Overlapping competitors');
      content.className = 'overlap-picker';
      heading.textContent = `${nearby.length} nearby mapped features`;
      hint.textContent = 'Choose a business to inspect. Source locations are unchanged.';
      content.append(heading, hint);
      for (const c of nearby) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${c.name ?? 'Unnamed mapped feature'} · ${c.relation} · ${Math.round(c.distanceMeters)} m`;
        button.addEventListener('click', () => choose(competitorId(c)));
        content.append(button);
      }
      L.DomEvent.disableClickPropagation(content);
      L.DomEvent.disableScrollPropagation(content);
      content.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          m.closePopup();
          focusMarker(clicked);
        }
      });
      L.popup({ className: 'overlap-popup', maxHeight: 230, minWidth: 220, maxWidth: 280, autoPan: true })
        .setLatLng(clicked.getLatLng())
        .setContent(content)
        .openOn(m);
      content.querySelector('button')?.focus();
    }

    L.circle([center.lat, center.lon], { radius, color: 'var(--accent)', weight: 1.5, fillColor: 'var(--accent)', fillOpacity: 0.07, dashArray: '5 7', interactive: false }).addTo(group);
    L.circleMarker([center.lat, center.lon], { radius: 4, color: 'var(--paper)', weight: 2, fillColor: 'var(--accent)', fillOpacity: 1, interactive: false, className: 'search-center-marker' }).addTo(group);

    const built: L.CircleMarker[] = [];
    for (const c of competitors) {
      const id = competitorId(c);
      const label = `${c.name ?? 'Unnamed mapped feature'}, ${categories[c.categoryId].label}, ${Math.round(c.distanceMeters)} meters`;
      const content = document.createElement('div');
      const name = document.createElement('strong');
      const meta = document.createElement('span');
      name.textContent = c.name ?? 'Unnamed mapped feature';
      meta.textContent = `${categories[c.categoryId].label} · ${c.relation} · ${Math.round(c.distanceMeters)} m`;
      const hint = document.createElement('em');
      hint.textContent = 'Click for details';
      content.className = 'marker-preview';
      content.append(name, meta, hint);
      const color = c.relation === 'direct' ? 'var(--accent)' : 'var(--violet)';
      const marker = L.circleMarker([c.coordinates.lat, c.coordinates.lon], {
        radius: 6, color: 'var(--paper)', weight: 1.5, fillColor: color, fillOpacity: 1,
        bubblingMouseEvents: false, className: `competitor-marker ${c.relation}`,
      }).bindTooltip(content, { direction: 'top', offset: [0, -8], className: 'competitor-tooltip' });
      marker.on('click', () => activate(id));
      // A marker inside a cluster has no DOM element yet. Set up accessibility
      // each time Leaflet actually draws it on the map.
      marker.on('add', () => {
        const el = marker.getElement();
        if (!el) return;
        el.setAttribute('data-source-id', id);
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', label);
        el.setAttribute('aria-pressed', String(id === selected.current));
        if (!(el as HTMLElement & { _atlasBound?: boolean })._atlasBound) {
          (el as HTMLElement & { _atlasBound?: boolean })._atlasBound = true;
          el.addEventListener('keydown', event => {
            const e = event as KeyboardEvent;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              activate(id);
            }
          });
          el.addEventListener('focus', () => marker.openTooltip());
          el.addEventListener('blur', () => marker.closeTooltip());
        }
      });
      markers.current.set(id, marker);
      built.push(marker);
    }
    clusters.addLayers(built);
  }, [center.lat, center.lon, radius, competitors]);

  // 4. Highlight the selected business; open its cluster if needed.
  useEffect(() => {
    const m = map.current;
    const clusters = cluster.current;
    if (selectedId) m?.closePopup();
    for (const [id, marker] of markers.current) {
      const active = id === selectedId;
      marker.setRadius(active ? 10 : 6);
      marker.setStyle({ weight: active ? 3 : 1.5 });
      marker.getElement()?.setAttribute('aria-pressed', String(active));
    }
    const marker = selectedId ? markers.current.get(selectedId) : undefined;
    if (!marker || !m || !clusters) return;
    // These are CircleMarkers, not icon-based L.Markers. MarkerCluster's
    // zoomToShowLayer assumes an _icon and can throw after a filter rebuild.
    if(!marker.getElement()?.isConnected){
      m.setView(marker.getLatLng(),Math.max(m.getZoom(),UNCLUSTER_ZOOM),{animate:false});
    }
    if(marker.getElement()?.isConnected){
      marker.bringToFront();
      marker.getElement()?.setAttribute('aria-pressed','true');
      m.panInside(marker.getLatLng(),{...padding(true),animate:false});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectionTick, competitors]);

  return (
    <>
      <div ref={host} className="map-canvas" aria-label="Interactive area map" />
      <div className="map-actions" aria-label="Map navigation">
        <button onClick={() => navigate('center')}>⌖ Recenter</button>
        <button disabled={!competitors.length} onClick={() => navigate('results')}>⛶ Fit results</button>
      </div>
      {tilesFailed && <div className="tile-warning" role="status">Some map tiles are unavailable. Analysis and the evidence list still work.</div>}
    </>
  );
}