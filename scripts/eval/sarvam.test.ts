import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBudget, resolveDeadline, detectUrgent, normalizeConstraints, clarifyingQuestion } from '../../lib/sarvam/rules';
import { parseContent } from '../../lib/sarvam/extract';
import { sarvamFetch } from '../../lib/sarvam/client';
import { VoiceLaneError } from '../../lib/contracts';

test('budget amounts preserve currency and exclude piece counts', () => {
  for (const [text, amount] of [ ['1000 ke andar',1000], ['hazaar ke andar',1000], ['1000 se kam',1000], ['under 1000',1000], ['do hazaar tak',2000], ['₹800',800], ['Rs 800',800], ['800 rupaye',800], ['paanch sau tak',500], ['dedh hazaar',1500], ['१००० के अंदर',1000], ['1000 piece puzzle under 800',800] ] as const) assert.equal(parseBudget(text), amount, text);
  assert.equal(parseBudget('1000 piece puzzle'), null);
});
test('calendar rollover and unambiguous dates', () => {
  assert.equal(resolveDeadline('tomorrow','2026-12-31'),'2027-01-01');
  assert.equal(resolveDeadline('day_after','2026-10-31'),'2026-11-02');
  assert.equal(resolveDeadline('this_weekend','2026-10-31'),'2026-11-01');
  assert.equal(resolveDeadline('specific_date','2026-10-31','2026-02-30'),null);
  assert.equal(resolveDeadline('specific_date','2026-10-31','11/02'),null);
});
test('urgency, vocabulary, fixed clarifying templates', () => {
  for (const text of ['abhi', 'turant', 'das minute', '10 minute', 'right now', 'lagech']) assert.equal(detectUrgent(text),true,text);
  assert.deepEqual(normalizeConstraints([' Rechargeable ', 'EGGLESS', 'cute', 'pieces:1000']), {hard_constraints:['rechargeable','eggless','pieces:1000'],soft_preferences:['cute']});
  assert.equal(clarifyingQuestion(['max_budget','needed_by'],'hi-IN'),'Aapka budget kitna hai?');
});
test('JSON cleanup handles nested braces and think blocks', () => {
  const data = {item:null,item_key:null,hard_constraints:[],soft_preferences:['{nice}'],max_budget:null,quantity:null,deadline_token:'none',deadline_spoken:null,urgent:false,language:'en-IN'};
  assert.deepEqual(parseContent('<think>hidden</think>```json\n'+JSON.stringify(data)+'\n```'),data);
  assert.throws(() => parseContent('{}'));
});
test('client timeout covers response body; status and key stay safe', async () => {
  const previous = globalThis.fetch;
  const key = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = 'test-only';
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get('api-subscription-key'), 'test-only');
      return {ok:true,status:200,json:() => new Promise((_resolve,reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))} as Response;
    };
    await assert.rejects(sarvamFetch('extract','/test',{},20), (error: unknown) => error instanceof VoiceLaneError && error.kind === 'timeout');
    globalThis.fetch = async () => new Response('test-only', {status:401});
    await assert.rejects(sarvamFetch('speak','/test',{},100), (error: unknown) => error instanceof VoiceLaneError && error.message === 'Sarvam HTTP 401');
  } finally {
    globalThis.fetch = previous;
    if (key === undefined) delete process.env.SARVAM_API_KEY; else process.env.SARVAM_API_KEY = key;
  }
});

test('rules off switch returns contract basic mode without network or key', async () => {
  const { sarvamLane } = await import('../../lib/sarvam');
  const previous = process.env.SARVAM_EXTRACT_MODE;
  const realFetch = globalThis.fetch;
  let calls = 0;
  process.env.SARVAM_EXTRACT_MODE = 'rules';
  globalThis.fetch = async () => { calls++; throw new Error('No network allowed'); };
  try {
    const result = await sarvamLane.extract('RC car hazaar ke andar kal tak', '2026-10-31');
    assert.equal(result.mode, 'rules_fallback');
    assert.equal(result.max_budget, 1000);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
    if (previous === undefined) delete process.env.SARVAM_EXTRACT_MODE; else process.env.SARVAM_EXTRACT_MODE = previous;
  }
});

test('AI repair and deterministic overrides return complete request', async () => {
  const { sarvamLane } = await import('../../lib/sarvam');
  const realFetch = globalThis.fetch;
  const previousMode = process.env.SARVAM_EXTRACT_MODE;
  const previousKey = process.env.SARVAM_API_KEY;
  process.env.SARVAM_EXTRACT_MODE = 'ai'; process.env.SARVAM_API_KEY = 'test-only';
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.reasoning_effort, null);
    assert.equal(body.max_tokens, 800);
    calls++;
    const candidate = {item:'remote control car',item_key:'rc_car',hard_constraints:[' Rechargeable ','cute'],soft_preferences:[],max_budget:999,quantity:null,deadline_token:'tomorrow',deadline_spoken:'kal',urgent:false,language:'hi-IN'};
    return Response.json({choices:[{finish_reason:'stop',message:{content:calls===1?'{}':JSON.stringify(candidate)}}]});
  };
  try {
    const source = 'RC car hazaar ke andar kal tak abhi';
    const result = await sarvamLane.extract(source,'2026-10-31');
    assert.equal(calls,2); assert.equal(result.mode,'ai'); assert.equal(result.max_budget,1000);
    assert.equal(result.needed_by,'2026-11-01'); assert.equal(result.urgent,true);
    assert.deepEqual(result.hard_constraints,['rechargeable']); assert.deepEqual(result.soft_preferences,['cute']);
    assert.equal(result.source_text,source); assert.deepEqual(result.missing,[]);
  } finally {
    globalThis.fetch=realFetch;
    if(previousMode===undefined) delete process.env.SARVAM_EXTRACT_MODE; else process.env.SARVAM_EXTRACT_MODE=previousMode;
    if(previousKey===undefined) delete process.env.SARVAM_API_KEY; else process.env.SARVAM_API_KEY=previousKey;
  }
});
