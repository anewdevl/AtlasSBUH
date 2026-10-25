import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {buildExportBrief} from '../src/lib/report-export';
import {createReportPdf,createReportDeck} from '../src/lib/report-files';
async function main(){
 const brief=buildExportBrief(JSON.parse(await readFile('.atlas-local/live-research.json','utf8')),'NYC preset');
 await mkdir('.atlas-local/exports',{recursive:true});
 const fonts={regular:await readFile('public/fonts/NotoSans-Regular.ttf'),bold:await readFile('public/fonts/NotoSans-Bold.ttf')};
 await writeFile('.atlas-local/exports/research-report.pdf',await createReportPdf(brief,undefined,fonts));
 await writeFile('.atlas-local/exports/research-deck.pptx',await createReportDeck(brief));
 console.log(JSON.stringify({status:brief.report.status,findings:brief.report.findings.length,insights:brief.report.insights.length,sources:brief.report.evidence.length}));
}
main().catch(()=>{console.error('Export check failed.');process.exitCode=1;});
