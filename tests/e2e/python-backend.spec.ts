import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import JSZip from 'jszip';
import {reportSchema} from '../../src/lib/research-contracts';

// Explicit opt-in: this test uses the real server credentials and real providers.
test('Python-backed app searches, maps, compares, researches, assesses and exports',async({page},testInfo)=>{
 test.skip(process.env.ATLAS_PYTHON_E2E!=='1','Live provider test; opt in with ATLAS_PYTHON_E2E=1.');
 test.setTimeout(240000);
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.addInitScript(()=>{
  const original=window.fetch;
  window.fetch=async(...args)=>{
   const response=await original(...args);
   if(String(args[0]).includes('/api/research'))void response.clone().text().then(text=>Object.assign(window,{atlasResearchStream:text}));
   return response;
  };
 });
 await page.goto('/');
 await expect(page.locator('.leaflet-container')).toBeVisible();
 await page.getByLabel('Find a location',{exact:true}).fill('Washington Square');
 const locationResponse=page.waitForResponse(r=>r.url().includes('/api/locations?'));
 await page.getByRole('button',{name:'Search locations'}).click();
 const locations=await locationResponse;expect(locations.headers()['x-atlas-backend']).toBe('python');expect(locations.status()).toBe(200);
 await expect(page.getByLabel('Location results').getByRole('button').first()).toBeVisible();
 // Keep the preset for the measured research; selection behavior has separate fixture tests.
 const mapResponse=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));
 await page.getByRole('button',{name:'Analyze this area'}).click();
 const mapped=await mapResponse;expect(mapped.headers()['x-atlas-backend']).toBe('python');expect(mapped.status()).toBe(200);
 await expect(page.locator('.feature').first()).toBeVisible({timeout:40000});
 await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
 await page.getByRole('button',{name:'Pin for comparison'}).click();
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByText('Advanced settings',{exact:true}).click();
 await page.getByLabel('Latitude',{exact:true}).fill('40.7310');
 await page.getByRole('button',{name:'Analyze this area'}).click();
 await expect(page.getByRole('heading',{name:'Café · New York'})).toBeVisible({timeout:40000});
 await page.getByRole('navigation',{name:'Explorer views'}).getByRole('button',{name:/^Compare/}).click();
 await expect(page.getByLabel('Area comparison')).toContainText('PINNED AREA');
 // Restore matching radius so comparisons and research share the original scope.
 await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('Latitude',{exact:true}).fill('40.7308');
 await page.getByRole('button',{name:'Research',exact:true}).click();
 await page.getByLabel('Business description',{exact:true}).fill('Specialty coffee with fast morning pickup');
 const researchResponse=page.waitForResponse(r=>r.url().endsWith('/api/research'));
 await page.getByRole('button',{name:'Generate insights'}).click();
 const streamed=await researchResponse;expect(streamed.headers()['x-atlas-backend']).toBe('python');
 await expect(page.getByLabel('Research report',{exact:true})).toBeVisible({timeout:115000});
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {atlasResearchStream?:string}).atlasResearchStream)).toBeTruthy();
 const stream=await page.evaluate(()=>(window as unknown as {atlasResearchStream:string}).atlasResearchStream);
 const events=stream.trim().split('\n').map(line=>JSON.parse(line));
 expect(events.some(e=>e.type==='stage')).toBe(true);
 const report=reportSchema.parse(events.find(e=>e.type==='report')?.report);
 expect(report.findings.length).toBeGreaterThan(0);
 await expect(page.getByLabel('Research report',{exact:true}).getByRole('heading',{name:/^(Recommended|Not recommended)$/})).toBeVisible();
 await expect(page.getByRole('region',{name:'Ranked local shortlist'})).toBeVisible();
 for(const [button,file] of [['Download PDF','live-report.pdf'],['Download slides (.pptx)','live-report.pptx']] as const){
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();
  const download=await downloading;const path=testInfo.outputPath(file);await download.saveAs(path);
  const content=await readFile(path);
  if(file.endsWith('.pdf'))expect((await PDFDocument.load(content)).getPageCount()).toBeGreaterThan(1);
  else expect(Object.keys((await JSZip.loadAsync(content)).files).some(f=>f.startsWith('ppt/slides/slide'))).toBe(true);
 }
 await page.locator('.opening-assessment').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('python-research.png'),fullPage:true});
 await page.getByRole('button',{name:'Locations',exact:true}).click();
 const adviceResponse=page.waitForResponse(r=>r.url().endsWith('/api/location-advice'));
 await page.getByRole('button',{name:'Assess this location'}).click();
 const advice=await adviceResponse;expect(advice.headers()['x-atlas-backend']).toBe('python');expect(advice.status()).toBe(200);
 await expect(page.getByRole('region',{name:'Location assessment'})).toContainText('Location evidence reviewed',{timeout:65000});
 await page.screenshot({path:testInfo.outputPath('python-location.png'),fullPage:true});
});
