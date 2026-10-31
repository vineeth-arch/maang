import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sarvamLane } from '../../lib/sarvam';
import { extractRules, resolveDeadline } from '../../lib/sarvam/rules';
import { VoiceLaneError, type ExtractedRequest, type RelativeDeadline } from '../../lib/contracts';
import cases from './cases.json';

// Load only provider settings. Never print environment contents.
if (existsSync('.env.local')) {
  const env = readFileSync('.env.local', 'utf8');
  for (const name of ['SARVAM_API_KEY', 'SARVAM_STT_MODEL', 'SARVAM_CHAT_MODEL', 'SARVAM_TTS_MODEL', 'SARVAM_TTS_SPEAKER']) {
    const match = env.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, 'm'));
    if (!process.env[name] && match) process.env[name] = match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}
const root = resolve('scripts/eval');
const today = '2026-10-31';
const hints = { item_keys: ['rc_car', 'gift_hamper', 'jigsaw_puzzle', 'cricket_bat'] };
type Check = { field: string; expected: unknown; got: unknown; pass: boolean };
type Row = { mode: string; id: string; checks: Check[]; error?: string; latencies: Record<string, number> };
const stateFile = resolve(root, 'measurements.json');
const rows: Row[] = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : [];
const requested = process.argv[2] || 'text';
if (!['text', 'audio', 'rules'].includes(requested)) throw new Error('Use text, audio, or rules');
for (let i = rows.length - 1; i >= 0; i--) if (requested === 'rules' ? rows[i].mode === 'rules_fallback' : requested === 'text' ? ['ai', 'rules_fallback'].includes(rows[i].mode) : rows[i].mode.startsWith('audio')) rows.splice(i, 1);
function score(result: ExtractedRequest, expected: Record<string, unknown>): Check[] {
  return Object.entries(expected).map(([field, value]) => {
    let got: unknown = result[field as keyof ExtractedRequest];
    let pass: boolean;
    if (field === 'deadline_token') { got = result.needed_by; pass = got === resolveDeadline(value as RelativeDeadline, today); }
    else if (field === 'forbidden_hard_prefix') { got = result.hard_constraints; pass = !result.hard_constraints.some(c => c.startsWith(String(value))); }
    else if (field === 'soft_preferences') { got = result.soft_preferences; pass = result.soft_preferences.join(' ').toLowerCase().includes(String(value)); }
    else if (field === 'item_key' && Array.isArray(value)) pass = value.includes(got);
    else if (Array.isArray(value)) pass = Array.isArray(got) && (value.length === 0 ? got.length === 0 : value.every(v => (got as unknown[]).includes(v)));
    else pass = got === value;
    return { field, expected: value, got, pass };
  });
}
function safeError(error: unknown): string {
  return error instanceof VoiceLaneError ? `${error.stage}/${error.kind}: ${error.message}` : 'Local evaluation error';
}
function fatal(error: unknown): boolean {
  return error instanceof VoiceLaneError && (/HTTP (401|403)|deprecated model/.test(error.message) || error.kind === 'config');
}
function report() {
  writeFileSync(stateFile, JSON.stringify(rows, null, 2) + '\n');
  const md = ['# Voice evaluation', '', `Measured: ${new Date().toISOString()}. Today fixed at ${today}.`, '', 'STT mode: transcribe. Models use configured environment or saaras:v3, sarvam-105b, bulbul:v3 defaults.', '', 'Synthetic audio is TTS round-trip audio, not real microphone evidence. Real clips have no labelled expectations and remain unscored. Deadline tokens are scored by their resolved ISO date because VoiceLane does not expose raw tokens.', '', '## Per-field totals', '', '| Field | AI text | Rules fallback | Audio AI |', '|---|---:|---:|---:|'];
  const fields = [...new Set(rows.flatMap(r => r.checks.map(c => c.field)))];
  for (const field of fields) {
    const totals = ['ai', 'rules_fallback', 'audio'].map(mode => {
      const checks = rows.filter(r => r.mode === mode).flatMap(r => r.checks.filter(c => c.field === field));
      return `${checks.filter(c => c.pass).length}/${checks.length}`;
    });
    md.push(`| ${field} | ${totals.join(' | ')} |`);
  }
  md.push('', '## Latency', '', '| Mode / stage | n | p50 ms | max ms |', '|---|---:|---:|---:|');
  for (const mode of [...new Set(rows.map(r => r.mode))]) for (const stage of ['extract', 'speak', 'transcribe']) {
    const values = rows.filter(r => r.mode === mode && r.latencies[stage] !== undefined).map(r => r.latencies[stage]).sort((a,b) => a-b);
    if (values.length) md.push(`| ${mode} / ${stage} | ${values.length} | ${values[Math.ceil(values.length / 2)-1]} | ${values.at(-1)} |`);
  }
  for (const row of rows) {
    md.push('', `## ${row.mode} case ${row.id}`, '', '| Field | Expected | Got | Pass |', '|---|---|---|---|');
    for (const c of row.checks) md.push(`| ${c.field} | ${JSON.stringify(c.expected)} | ${JSON.stringify(c.got)?.replace(/\|/g, '\\|')} | ${c.pass ? 'PASS' : 'FAIL'} |`);
    if (row.error) md.push('', row.error);
    if (!row.checks.length && !row.error) md.push('', 'Processed successfully; unlabelled real clip, no accuracy claim.');
  }
  md.push('', '## Known failures', '');
  const failures = rows.filter(r => r.error || r.checks.some(c => !c.pass));
  md.push(...(failures.length ? failures.map(r => `- ${r.mode} ${r.id}: ${r.error || r.checks.filter(c => !c.pass).map(c => c.field).join(', ')}`) : ['- No failures in measured cases.']));
  md.push('- Synthetic clips do not establish noisy-shop microphone accuracy.', '- Evaluation incomplete when recorded rows do not cover all 14 text cases and 6 synthetic audio cases. Network runs stop on repeated stage failures.', '- Fields omitted from a case expectation are not scored. Rules fallback uses a fixed vocabulary and misses unsupported or misspelt items.', '- Audio stages are measured separately; cached/generated audio skips are not counted as fresh TTS calls.');
  writeFileSync(resolve(root, 'RESULTS.md'), md.join('\n') + '\n');
}
const failuresByKind = new Map<string, number>();
async function evaluate(id: string, mode: string, text: string, expected: Record<string, unknown>, latencies: Record<string, number> = {}) {
  const started = performance.now();
  try {
    const result = mode === 'rules_fallback' ? extractRules(text, today, hints) : await sarvamLane.extract(text, today, hints);
    latencies.extract = Math.round(performance.now() - started);
    rows.push({ id, mode, checks: score(result, expected), latencies });
  } catch (error) {
    latencies.extract = Math.round(performance.now() - started);
    rows.push({ id, mode, checks: Object.entries(expected).map(([field, value]) => ({ field, expected: value, got: null, pass: false })), latencies, error: safeError(error) });
    report();
    const signature = error instanceof VoiceLaneError ? `${error.stage}/${error.kind}` : 'local';
    const count = (failuresByKind.get(signature) ?? 0) + 1;
    failuresByKind.set(signature, count);
    if (fatal(error) || count >= 2) throw error;
  }
  report();
}
async function audio(id: string, file: string, expected: Record<string, unknown>, latencies: Record<string, number>) {
  try {
    const normalized = file.replace(/\.[^.]+$/, '') + '.16k.wav';
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', file, normalized], { stdio: 'pipe' });
    const bytes = new Uint8Array(readFileSync(normalized));
    const result = await sarvamLane.transcribe(bytes.buffer, 'audio/wav');
    latencies.transcribe = result.ms;
    await evaluate(id, Object.keys(expected).length ? 'audio' : 'audio_real', result.text, expected, latencies);
  } catch (error) {
    if (!rows.some(r => r.id === id && r.mode.startsWith('audio'))) rows.push({ id, mode: 'audio', checks: Object.entries(expected).map(([field,value]) => ({ field, expected: value, got: null, pass: false })), latencies, error: safeError(error) });
    report();
    if (fatal(error)) throw error;
  }
}
async function main() {
  if (requested === 'rules') {
    for (const c of cases) await evaluate(String(c.id), 'rules_fallback', c.input_text, c.expected);
  } else if (requested === 'text') {
    for (const c of cases) {
      await evaluate(String(c.id), 'ai', c.input_text, c.expected);
      await evaluate(String(c.id), 'rules_fallback', c.input_text, c.expected);
    }
  } else {
    mkdirSync(resolve(root, 'audio/real'), { recursive: true });
    for (const c of cases.filter(c => [1,2,4,5,7,12].includes(c.id))) {
      const file = resolve(root, `audio/case-${c.id}.wav`);
      const latencies: Record<string,number> = {};
      if (!existsSync(file)) {
        const started = performance.now();
        const result = await sarvamLane.speak(c.input_text, c.language);
        latencies.speak = Math.round(performance.now() - started);
        writeFileSync(file, Buffer.from(result.audio));
      }
      await audio(String(c.id), file, c.expected, latencies);
    }
    const real = resolve(root, 'audio/real');
    for (const name of readdirSync(real).filter(n => !n.endsWith('.16k.wav') && /\.(wav|m4a|mp3|aac|aiff?|caf|flac|ogg|mp4)$/i.test(n))) await audio(`real:${basename(name, extname(name))}`, resolve(real, name), {}, {});
  }
  report();
  console.info(`Evaluation ${requested}: ${rows.length} recorded rows; see scripts/eval/RESULTS.md`);
}
main().catch(error => { report(); console.error(safeError(error)); process.exitCode = 1; });
