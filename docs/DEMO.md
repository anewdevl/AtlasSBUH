# Local demo runbook

1. Start the verified build with `npm run start -- --hostname 127.0.0.1 --port 3000` (run `npm run build` after edits). Development is also available through `npm run dev`.
2. Describe a neighborhood supermarket. Keep New York / 1 km / no adjacent categories for the prepared genuine snapshot scope. Show Find a location and choose an address result to demonstrate pin placement; return to the city preset before the fallback demonstration.
3. Analyze. Business interpretation applies automatically. Inspect a competitor marker, source tags, original retrieval date and OSM link. Explain that mapped counts have unknown coverage. Save the analysis in this browser.
4. Pin for comparison. Return to Search, select London with the same type, radius and adjacent settings, then analyze. Compare independent counts, dates and cache states without claiming a winner.
5. Open Research. Nothing is generated until Generate insights is clicked. Show the short overview, practical next steps, three initial candidates, expandable supporting quotes and sources. A partial report may still contain supported findings; missing reviews/prices remain explicitly unknown.
6. Click Assess this location for evidence around the chosen pin and relevant investigation checks. Explain that this checks mapped context; premises availability, rent, footfall and zoning are unverified.
7. Demonstrate Light/Dark, map recenter and mobile controls as time permits.

## Backup

Genuine bundled snapshots cover café, bakery, bubble tea, pharmacy and supermarket at the four exact 1 km city presets with no adjacent categories. Fallback must match the exact scope and remain within its age window. Custom addresses/radii and other types may require live map retrieval. A successful research report can be kept open during the demo; research has no automatic offline fallback. Original dates are always preserved.

Ignored `.atlas-local/live-research.json` contains the last real research diagnostic and `.atlas-local/demo-competitor.png` / `demo-comparison.png` provide genuine screenshots from the live browser rehearsal. These are backup artifacts, not automatic in-app substitute results. Synthetic test fixtures never serve as genuine demo data. Tile failures leave the evidence list usable. If providers fail without compatible data, show the unavailable state.

Run `npx tsx scripts/rehearse-demo.ts` to repeat the live address search, supermarket analysis, evidence inspection, save and comparison journey. Live checks make real provider requests; automated Vitest/Playwright tests mock upstream data.
