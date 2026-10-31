import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sarvamLane } from '../../lib/sarvam';
import { parseContent } from '../../lib/sarvam/extract';
import cases from './cases.json';

const env = readFileSync('.env.local', 'utf8');
for (const name of ['SARVAM_API_KEY','SARVAM_CHAT_MODEL','SARVAM_STT_MODEL','SARVAM_TTS_MODEL','SARVAM_TTS_SPEAKER','SARVAM_EXTRACT_MODE']) {
  const match = env.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`,'m'));
  if (process.env[name] === undefined && match) process.env[name] = match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
}
const key = process.env.SARVAM_API_KEY?.trim();
if (!key) throw new Error('Missing key');
async function main() {
  const realFetch = globalThis.fetch;
  let captured: { url: string; body: string } | undefined;
  globalThis.fetch = async (url, init) => { captured = {url:String(url),body:String(init?.body)}; throw new Error('Capture only'); };
  try { await sarvamLane.extract(cases[Number(process.argv.find(a => a.startsWith('--case='))?.slice(7) || '1') - 1].input_text, '2026-10-31', {item_keys:['rc_car','gift_hamper','jigsaw_puzzle','cricket_bat']}); } catch {} finally { globalThis.fetch=realFetch; }
  if (!captured) throw new Error('No request captured; ensure AI mode');
  const request = captured as {url:string;body:string};
  const dir = mkdtempSync(join(tmpdir(),'maang-diag-'));
  const results: unknown[] = [];
  const count = process.argv.includes('--once') ? 1 : 4;
  try {
    for (let i=0;i<count;i++) {
      const body=JSON.parse(request.body);
      if (i===3) { body.max_tokens=50; body.messages=body.messages.map((m: {role:string;content:string}) => m.role==='user'?{...m,content:'Say OK'}:m); }
      const input=join(dir,'request.json'), output=join(dir,'response.json');
      writeFileSync(input,JSON.stringify(body),{mode:0o600});
      const start=performance.now();
      const curl=spawnSync('curl',['-s','--max-time','45','-o',output,'-w','%{http_code} %{time_total}\n','--config','-','--data-binary',`@${input}`,request.url],{input:`header = "api-subscription-key: ${key}"\nheader = "Content-Type: application/json"\n`,encoding:'utf8'});
      let finish: unknown=null, valid=false, tokens: unknown=null;
      if (existsSync(output)) {
        try { const response=JSON.parse(readFileSync(output,'utf8')); finish=response.choices?.[0]?.finish_reason; tokens=response.usage?.completion_tokens; try {parseContent(response.choices?.[0]?.message?.content);valid=true;} catch {} } catch {}
      }
      const row={label: i===3?'say_ok_50':`exact_${i+1}`,http_and_seconds:curl.stdout.trim(),exit:curl.status,elapsed_ms:Math.round(performance.now()-start),finish,valid_json:valid,completion_tokens:tokens};
      results.push(row); console.log(JSON.stringify(row));
      writeFileSync(`scripts/eval/diagnostics${process.argv.find(a => a.startsWith('--label='))?.slice(8) || ''}.json`,JSON.stringify(results,null,2)+'\n');
      if (/^(401|403)\b/.test(curl.stdout)) throw new Error('Provider authorization stop condition');
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
}
main().catch(() => {console.error('Diagnostic stopped; inspect status measurements, no response bodies logged');process.exitCode=1;});
