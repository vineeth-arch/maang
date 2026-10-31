import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sarvamLane } from '../../lib/sarvam';
import { VoiceLaneError } from '../../lib/contracts';
const env = readFileSync('.env.local', 'utf8');
for (const name of ['SARVAM_API_KEY', 'SARVAM_STT_MODEL']) {
  const m = env.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, 'm'));
  if (process.env[name] === undefined && m) process.env[name] = m[1].trim().replace(/^(['"])(.*)\1$/, '$2');
}
async function main() {
  // Existing generated smoke clip only. Never describe this as microphone evidence.
  execFileSync('afconvert', ['-f','WAVE','-d','LEI16@16000','-c','1','scripts/eval/audio/tts-smoke.wav','scripts/eval/audio/tts-smoke.16k.wav'], {stdio:'pipe'});
  const bytes = new Uint8Array(readFileSync('scripts/eval/audio/tts-smoke.16k.wav'));
  const result = await sarvamLane.transcribe(bytes.buffer, 'audio/wav');
  const measurement = {source:'synthetic TTS smoke, not a real clip',...result};
  writeFileSync('scripts/eval/stt-measurement.json',JSON.stringify(measurement,null,2)+'\n');
  console.log(JSON.stringify(measurement));
}
main().catch(error => { console.error(error instanceof VoiceLaneError ? `${error.stage}/${error.kind}: ${error.message}` : 'Local STT smoke error'); process.exitCode=1; });
