import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { responseSchema } from '../src/lib/contracts';
import { reportSchema, stageSchema } from '../src/lib/research-contracts';
import { locationAdviceSchema } from '../src/lib/location-advisor';
const fixtures=JSON.parse(execFileSync(process.env.ATLAS_PYTHON || 'python',['python_backend/tests/export_contracts.py'],{encoding:'utf8'}));
responseSchema.parse(fixtures.analysis);locationAdviceSchema.parse(fixtures.advice);
for(const row of fixtures.reports){reportSchema.parse(row.report);for(const event of row.events)stageSchema.parse(event.stage);}
mkdirSync('docs/measurements',{recursive:true});
writeFileSync('docs/measurements/evaluation.json',JSON.stringify({measuredAt:new Date().toISOString(),type:'deterministic synthetic provider fixtures',cases:fixtures.reports.map((r:{case:string;report:{status:string;findings:unknown[];impacts:unknown[]};metrics:object;searches:number;reviews:number})=>({case:r.case,status:r.report.status,findings:r.report.findings.length,impacts:r.report.impacts.length,searches:r.searches,reviews:r.reviews,metrics:r.metrics}))},null,2));
console.log(`Python responses passed original frontend schemas: ${fixtures.reports.length} research scenarios, map analysis and location advice.`);
