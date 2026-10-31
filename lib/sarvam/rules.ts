import type { ExtractedRequest, RelativeDeadline } from '../contracts';

type Lang = 'hi-IN' | 'mr-IN' | 'en-IN';

const DEVA_DIGITS = '०१२३४५६७८९';

export function normalise(text: string): string {
  let s = '';
  for (const ch of text) {
    const i = DEVA_DIGITS.indexOf(ch);
    s += i >= 0 ? String(i) : ch;
  }
  return s
    .normalize('NFC')
    .replace(/[​-‍﻿]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolveDeadline(rel: RelativeDeadline, todayISO: string, spokenDate?: string | null): string | null {
  if (rel === 'none') return null;
  if (rel === 'specific_date') {
    if (!spokenDate || !/^\d{4}-\d{2}-\d{2}$/.test(spokenDate)) return null;
    const date = new Date(spokenDate + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === spokenDate ? spokenDate : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayISO)) return null;
  const base = new Date(todayISO + 'T00:00:00Z');
  if (Number.isNaN(base.getTime())) return null;
  const day = base.getUTCDay();
  let add = 0;
  if (rel === 'tomorrow') add = 1;
  else if (rel === 'day_after') add = 2;
  else if (rel === 'this_week' || rel === 'this_weekend') add = (7 - day) % 7;
  base.setUTCDate(base.getUTCDate() + add);
  return isoOf(base);
}

export function clarifyingQuestion(
  missing: Array<'item' | 'max_budget' | 'needed_by'>,
  language: string,
): string | null {
  if (missing.length === 0) return null;
  const lang = language === 'mr-IN' ? 'mr' : language === 'hi-IN' ? 'hi' : 'en';
  if (missing.includes('item') && !missing.includes('max_budget') && !missing.includes('needed_by')) {
    return { hi: 'Kya chahiye?', en: 'What do you need?', mr: 'Kay pahije?' }[lang];
  }
  if (missing.includes('max_budget')) {
    return {
      hi: 'Aapka budget kitna hai?',
      en: "What's your budget?",
      mr: 'Tumcha budget kiti aahe?',
    }[lang];
  }
  return {
    hi: 'Kab tak chahiye?',
    en: 'By when do you need it?',
    mr: 'Kadhi paryant pahije?',
  }[lang];
}

const ITEMS: Array<{ key: string; label: string; re: RegExp }> = [
  {
    key: 'rc_car',
    label: 'remote control car',
    re: /\brc[\s-]?car\b|remote\s+wali\s+(gaadi|gadi|car)|remote[\s-]+control\s+car|remote\s+car|रिमोट\s+वाली\s+गाड़ी|रिमोट\s+वाली\s+गाडी|रिमोट\s+कार|रिमोट/,
  },
  { key: 'cake', label: 'cake', re: /\bcake\b|केक/ },
  { key: 'car', label: 'car', re: /\bcar\b|कार/ },
  { key: 'gift_hamper', label: 'gift hamper', re: /gift\s+hamper|hamper|गिफ्ट\s+हैम्पर|हैम्पर/ },
  { key: 'jigsaw_puzzle', label: 'jigsaw puzzle', re: /puzzle|jigsaw|पज़ल|पजल|पज़्ल/ },
  { key: 'cricket_bat', label: 'cricket bat', re: /cricket\s+bat|\bbat\b|क्रिकेट\s+बैट|बैट/ },
];

const WORD_NUMS: Array<[RegExp, number]> = [
  [/\bdhai\s+(hazaar|hazar|hajar)\b|ढाई\s+(हज़ार|हजार)/, 2500],
  [/\bdedh\s+(hazaar|hazar|hajar)\b|डेढ़\s+(हज़ार|हजार)|डेढ\s+(हज़ार|हजार)/, 1500],
  [/\bteen\s+(hazaar|hazar|hajar)\b|तीन\s+(हज़ार|हजार)/, 3000],
  [/\bdo\s+(hazaar|hazar|hajar)\b|दो\s+(हज़ार|हजार)/, 2000],
  [/\b(paanch|panch|paach)\s+sau\b|(पांच|पाँच)\s+सौ/, 500],
  [/\b(hazaar|hazar|hajar)\b|हज़ार|हजार/, 1000],
  [/\bsau\b|सौ/, 100],
];

function wordAmount(s: string): number | null {
  for (const [re, v] of WORD_NUMS) if (re.test(s)) return v;
  return null;
}

export function budgetAmount(s: string): number | null {
  // Numeric forms with explicit currency markers.
  let m = s.match(/(?:rs\.?|₹|inr)\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/);
  if (m) return toAmount(m[1], m[2]);
  m = s.match(/(\d[\d,]*(?:\.\d+)?)\s*(k\b)?\s*(?:rupaye|rupees?|rupiye|rs\b\.?|रुपये|रुपए|रुपया)/);
  if (m) return toAmount(m[1], m[2]);
  // Budget phrase around a number (exclude "<n> pieces").
  const re =
    /(\d[\d,]*(?:\.\d+)?)\s*(k\b)?\s*(?!pieces?\b|piece\b|pcs\b|टुकड़े|टुकड़ा|टुकडे)(?:ke\s+andar|ke\s+ander|se\s+kam|tak\b|paryant|पर्यंत|के\s+अंदर|से\s+कम|तक)/;
  m = s.match(re);
  if (m) return toAmount(m[1], m[2]);
  m = s.match(/(?:under|below|within|upto|up\s+to|max(?:imum)?)\s*(?:rs\.?|₹)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/);
  if (m) return toAmount(m[1], m[2]);
  // Hindi / Marathi number words (before generic numbers).
  const wordCtx =
    /(?:(?:dhai|dedh|teen|do|paanch|panch|paach)\s+)?(?:hazaar|hazar|hajar|sau)\b|(?:(?:ढाई|डेढ़|डेढ|तीन|दो|पांच|पाँच)\s+)?(?:हज़ार|हजार|सौ)/;
  const wm = s.match(wordCtx);
  if (wm) {
    const v = wordAmount(wm[0]);
    if (v !== null) return v;
  }
  // "1k" or comma number standing alone.
  m = s.match(/\b(\d+(?:\.\d+)?)\s*k\b/);
  if (m) return toAmount(m[1], 'k');
  m = s.match(/\b(\d{1,3}(?:,\d{2,3})+)\b/);
  if (m) return toAmount(m[1], undefined);
  return null;
}

function toAmount(num: string, k: string | undefined): number | null {
  const n = parseFloat(num.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(k ? n * 1000 : n);
}

type Deadline = { rel: RelativeDeadline; label: string };

export function extractDeadline(s: string): Deadline | null {
  const rules: Array<[RegExp, RelativeDeadline]> = [
    [/\bparso\b|परसों|परसो/, 'day_after'],
    [/\bkal(?:\s+(?:subah|shaam|sham|raat|dopahar))?\b|कल(?:\s+(?:सुबह|शाम|रात|दोपहर))?/, 'tomorrow'],
    [/\budya\b|उद्या/, 'tomorrow'],
    [/\btomorrow\b/, 'tomorrow'],
    [/\baaj\b|आज/, 'today'],
    [/\btoday\b/, 'today'],
    [/\bis\s+hafte\b|\bthis\s+week\b|इस\s+हफ्ते|इस\s+सप्ताह/, 'this_week'],
    [/\b(?:sunday|ravivaar|ravivar|rabivar)\s+tak\b|\bby\s+sunday\b|\bweekend\b|रविवार\s+तक|रविवार|वीकेंड/, 'this_weekend'],
  ];
  for (const [re, rel] of rules) {
    const m = s.match(re);
    if (m) return { rel, label: m[0] };
  }
  return null;
}

export function detectUrgent(text: string): boolean { return URGENT_RE.test(normalise(text)); }

const URGENT_RE =
  /\babhi\b|\bturant\b|\bdas\s+minute\b|\b10\s+minutes?\b|\bright\s+now\b|\blagech\b|लगेच|\bjaldi\b|\burgent\b|अभी|तुरंत|जल्दी/;

function detectLanguage(raw: string, s: string): Lang {
  const hasDeva = /[ऀ-ॿ]/.test(raw);
  const marathi = /\b(aahe|ahe|pahije|paahije|paryant|kiti|udya)\b|आहे|पाहिजे|पर्यंत|उद्या/.test(s);
  if (hasDeva) return marathi ? 'mr-IN' : 'hi-IN';
  if (marathi) return 'mr-IN';
  if (/\b(chahiye|chahie|andar|ander|wala|wali|kal|hai|nahi|hazaar|rupaye|aaj|parso|abhi|turant|tak)\b/.test(s)) {
    return 'hi-IN';
  }
  return 'en-IN';
}

function extractQuantity(s: string, itemRe: RegExp | null): number | null {
  const m = s.match(/\b(\d{1,2}|do|two|teen|three)\s+(?:wali\s+|wala\s+)?(?=rc|remote|gift|hamper|puzzle|jigsaw|cricket|bat\b)/);
  if (m) {
    const w = m[1];
    if (/^\d+$/.test(w)) return parseInt(w, 10);
    return { do: 2, two: 2, teen: 3, three: 3 }[w] ?? null;
  }
  const c = s.match(/\b(\d{1,2})\s+chahiye\b/);
  if (c && itemRe) return parseInt(c[1], 10);
  return null;
}

export function extractRules(
  text: string,
  todayISO: string,
  hints?: { item_keys: string[] },
): ExtractedRequest {
  void hints; // an unstocked item is still returned; the shop decides "no match".
  const s = normalise(text);

  const found = ITEMS.find((it) => it.re.test(s)) ?? null;

  const constraints = new Set<string>();
  if (/rechargeable|charging\s+wala|battery\s+wala\s+nahi|रिचार्जेबल|चार्जिंग\s+वाला/.test(s)) {
    constraints.add('rechargeable');
  }
  if (/cell\s+wala|\baa\s+battery|सेल\s+वाला/.test(s)) constraints.add('disposable_batteries');
  if (/eggless|एगलेस/.test(s)) constraints.add('eggless');
  if (/sugar[ _-]?free/.test(s)) constraints.add('sugar_free');
  const size = s.match(/size\s+(\w+)/);
  if (size) constraints.add(`size:${size[1]}`);
  const pcs = s.match(/(\d+)\s*(?:pieces?|pcs|टुकड़े|टुकड़ा|टुकडे)/);
  if (pcs) constraints.add(`pieces:${parseInt(pcs[1], 10)}`);
  const hard = [...constraints].sort();

  const budget = parseBudget(s);
  const dl = extractDeadline(s);
  const urgent = detectUrgent(s);

  let needed_by: string | null = null;
  let needed_by_label: string | null = null;
  if (dl) {
    needed_by = resolveDeadline(dl.rel, todayISO);
    needed_by_label = dl.label;
  } else if (urgent) {
    needed_by = resolveDeadline('today', todayISO);
  }

  const language = detectLanguage(text, s);

  const missing: Array<'item' | 'max_budget' | 'needed_by'> = [];
  if (!found) missing.push('item');
  if (budget === null) missing.push('max_budget');
  if (needed_by === null && !urgent) missing.push('needed_by');

  let item: string | null = null;
  if (found) {
    item = constraints.has('rechargeable') && found.key === 'rc_car' ? `rechargeable ${found.label}` : found.label;
  }

  return {
    item,
    item_key: found ? found.key : null,
    hard_constraints: hard,
    soft_preferences: [],
    max_budget: budget,
    quantity: found ? extractQuantity(s, found.re) : null,
    needed_by,
    needed_by_label,
    urgent,
    language,
    missing,
    clarifying_question: clarifyingQuestion(missing, language),
    source_text: text,
    mode: 'rules_fallback',
  };
}

export function parseBudget(text: string): number | null {
  const s = normalise(text);
  if (/paachshe|paachsh[eé]|पाचशे/.test(s)) return 500;
  return budgetAmount(s);
}

export function normalizeConstraints(list: string[]): { hard_constraints: string[]; soft_preferences: string[] } {
  const hard: string[] = [], soft: string[] = [];
  for (const raw of list) {
    const value = raw.toLowerCase().trim();
    if (/^(rechargeable|disposable_batteries|eggless|sugar_free)$/.test(value) || /^(size|color|age|brand):[^:\s][^:]*$/.test(value) || /^pieces:[1-9]\d*$/.test(value)) hard.push(value);
    else if (value) soft.push(value);
  }
  return { hard_constraints: [...new Set(hard)], soft_preferences: [...new Set(soft)] };
}
