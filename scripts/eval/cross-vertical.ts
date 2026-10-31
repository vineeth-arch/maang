import {readFileSync,writeFileSync} from 'node:fs';
import {sarvamLane} from '../../lib/sarvam';
// The app's own rules engine (used by app/api/capture/extract), not lib/sarvam/rules.
import {extractRules} from '../../lib/voice-fallback';
import {VoiceLaneError, type ExtractedRequest} from '../../lib/contracts';
import {scoreCase, reportPassRate, THRESHOLDS, type Check} from './score';
import cases from './cases.json';
const env=readFileSync('.env.local','utf8');
for(const name of ['SARVAM_API_KEY','SARVAM_EXTRACT_MODE','SARVAM_CHAT_MODEL']) {
 const m=env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`,'m'));
 if(process.env[name]===undefined&&m)process.env[name]=m[1].trim().replace(/^(['"])(.*)\1$/,'$2');
}
async function main(){
 const rows: {id:string|number;mode:string;actual_mode:'ai'|'rules_fallback'|'error';ms:number;error:string;checks:Check[]}[]=[]; let aiEnabled=(process.env.SARVAM_EXTRACT_MODE?.trim()||'ai')==='ai';
 for(const c of cases.filter(c=>String(c.id).startsWith('xv-'))){
  for(const mode of ['rules','ai']){
   if(mode==='ai'&&!aiEnabled)continue;
   const start=performance.now();let result: ExtractedRequest | undefined;let error='';
   try{result=mode==='rules'?extractRules(c.input_text,'2026-10-31'):await sarvamLane.extract(c.input_text,'2026-10-31');}
   catch(e){error=e instanceof VoiceLaneError?`${e.stage}/${e.kind}: ${e.message}`:'evaluation error';if(e instanceof VoiceLaneError&&(e.kind==='timeout'||e.kind==='config'||/401|403/.test(e.message)))aiEnabled=false;}
   const checks=result?scoreCase(result,c.expected,'2026-10-31'):Object.entries(c.expected).map(([field,expected])=>({field,expected,got:null,pass:false}));
   rows.push({id:c.id,mode,actual_mode:result?result.mode:'error',ms:Math.round(performance.now()-start),error,checks});
  }
 }
 writeFileSync('scripts/eval/cross-vertical-results.json',JSON.stringify(rows,null,2)+'\n');
 const md=['## Beyond kirana','','First run only; todayISO=2026-10-31 (Saturday). No catalog hints supplied, so toy-only hints cannot bias cross-vertical matching. Saturday means today and Sunday means tomorrow for these expectations. These are extraction checks, not proof of booking, catalog or cross-store integrations.','', 'Expected fields were fixed before calls. Stylist gender is scored as a soft preference because the current hard-constraint vocabulary cannot encode it; that is a schema gap, not a valid booking constraint policy. Composite services, exact time, branch routing, 256 GB storage, wall mounting and next-week intervals are not fully scored because the contract lacks those fields. Medicine brand recognition is not medical advice.','','| Case | Mode | Fields passed | Case pass | ms |','|---|---|---:|---|---:|'];
 for(const r of rows)md.push(`| ${r.id} | ${r.mode} (actual ${r.actual_mode}) | ${r.checks.filter(c=>c.pass).length}/${r.checks.length} | ${r.checks.length>0&&r.checks.every(c=>c.pass)?'PASS':'FAIL'} | ${r.ms} |`);
 md.push('','| Field | Rules | AI |','|---|---:|---:|');
 for(const f of [...new Set(rows.flatMap(r=>r.checks.map(c=>c.field)))])md.push(`| ${f} | ${['rules','ai'].map(m=>{const a=rows.filter(r=>r.mode===m&&(m==='rules'||r.actual_mode==='ai')).flatMap(r=>r.checks.filter(c=>c.field===f));return `${a.filter(c=>c.pass).length}/${a.length}`;}).join(' | ')} |`);
 for(const r of rows){md.push('',`### ${r.id}: ${r.mode}`,'','| Field | Expected | Got | Pass |','|---|---|---|---|');for(const c of r.checks)md.push(`| ${c.field} | ${JSON.stringify(c.expected)} | ${JSON.stringify(c.got)} | ${c.pass?'PASS':'FAIL'} |`);if(r.error)md.push('',r.error);}
 md.push('','### Open rule and schema gaps','','- Fixed item vocabulary misses service names, medicine brands, apparel and electronics variants.','- Saturday, service appointment times and next-week intervals need explicit deadline semantics.','- Multi-service requests, stylist requirements, alternative branches, storage capacity and installation need future structured fields and catalog confirmation.','- Rules and AI failures above are retained without extractor edits or reruns. Skipped AI cases are untested, never counted as passes.');
 const path='scripts/eval/RESULTS.md';const prior=readFileSync(path,'utf8').split('\n## Beyond kirana')[0];writeFileSync(path,prior+'\n'+md.join('\n')+'\n');
 for(const mode of ['rules','ai'])console.log(`${mode}: ${rows.filter(r=>r.mode===mode&&r.checks.length>0&&r.checks.every(c=>c.pass)).length}/7 cases; attempted ${rows.filter(r=>r.mode===mode).length}`);
 if(!reportPassRate('Rules',rows.filter(r=>r.mode==='rules'),THRESHOLDS.rules))process.exitCode=1;
 const ai=rows.filter(r=>r.mode==='ai'&&r.actual_mode==='ai');
 console.log(`AI requested but fell back: ${rows.filter(r=>r.mode==='ai'&&r.actual_mode==='rules_fallback').length}`);
 if(!ai.length)console.log('AI not measured');
 else if(!reportPassRate('AI',ai,THRESHOLDS.ai))process.exitCode=1;
 if(rows.some(r=>r.actual_mode==='error')){console.log(`${rows.filter(r=>r.actual_mode==='error').length} rows errored`);process.exitCode=1;}
}
main().catch(()=>{console.error('Cross-vertical evaluation failed');process.exitCode=1;});
