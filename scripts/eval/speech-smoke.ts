import { existsSync, readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sarvamLane } from '../../lib/sarvam';
import { VoiceLaneError } from '../../lib/contracts';
const env=readFileSync('.env.local','utf8');
for (const name of ['SARVAM_API_KEY','SARVAM_STT_MODEL','SARVAM_TTS_MODEL','SARVAM_TTS_SPEAKER']) {
  const m=env.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`,'m'));
  if (process.env[name] === undefined && m) process.env[name]=m[1].trim().replace(/^(['"])(.*)\1$/,'$2');
}
async function main() {
  const local=resolve('scripts/eval/audio/real'); mkdirSync(local,{recursive:true});
  const other='/Users/vineethnair/Vibe Code/maang/scripts/eval/audio/real';
  if (existsSync(other)) for (const name of readdirSync(other)) if (/\.(wav|m4a|mp3|aac|aiff?|caf|flac|ogg|mp4)$/i.test(name) && !existsSync(resolve(local,name))) copyFileSync(resolve(other,name),resolve(local,name));
  const files=readdirSync(local).filter(n=>!n.endsWith('.16k.wav') && /\.(wav|m4a|mp3|aac|aiff?|caf|flac|ogg|mp4)$/i.test(n));
  const results: { real_clips: number; stt: {clip:string;text:string;ms:number}[]; tts_ms?:number; error?:string }={real_clips:files.length,stt:[]};
  console.log(`real_clips=${files.length}`);
  try {
    for (const name of files) {
      const input=resolve(local,name), output=input.replace(/\.[^.]+$/,'')+'.16k.wav';
      execFileSync('afconvert',['-f','WAVE','-d','LEI16@16000','-c','1',input,output],{stdio:'pipe'});
      const bytes=new Uint8Array(readFileSync(output));
      const result=await sarvamLane.transcribe(bytes.buffer,'audio/wav');
      results.stt.push({clip:name,text:result.text,ms:result.ms}); console.log(JSON.stringify(results.stt.at(-1)));
    }
    const started=performance.now();
    const speech=await sarvamLane.speak('Nayi maang aayi','hi-IN');
    results.tts_ms=Math.round(performance.now()-started);
    writeFileSync('scripts/eval/audio/tts-smoke.wav',Buffer.from(speech.audio));
    console.log(`tts_ms=${results.tts_ms}`);
  } catch(error) { results.error=error instanceof VoiceLaneError ? `${error.stage}/${error.kind}: ${error.message}` : 'Local speech smoke error'; console.error(results.error); process.exitCode=1; }
  writeFileSync('scripts/eval/speech-measurements.json',JSON.stringify(results,null,2)+'\n');
}
main().catch(()=>{ console.error('Speech smoke setup failed');process.exitCode=1; });
