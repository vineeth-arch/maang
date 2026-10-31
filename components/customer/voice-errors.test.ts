import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceErrorLine, type VoiceErrorKind } from './voice-errors';

const EXPECTED: Record<VoiceErrorKind, string> = {
  unsupported: 'Is browser mein mic nahi chalta. Neeche likh ke batayein.',
  in_app: 'App ke andar wale browser mein mic nahi chalta. Safari ya Chrome mein kholein, ya neeche likhein.',
  denied: 'Mic ki permission nahi mili. Settings mein mic allow karein, ya neeche likhein.',
  no_audio: 'Mic se awaaz nahi aayi. Dobara tap karein, ya neeche likhein.',
  too_short: 'Bahut chhota tha. Tap karke poori baat bolein.',
  empty: 'Awaaz samajh nahi aayi. Dobara bolein, ya neeche likhein.',
  server: 'Awaaz abhi nahi chal rahi. Neeche likh ke batayein.',
  failed: 'Awaaz abhi nahi chal rahi. Neeche likh ke batayein.',
};

for (const [kind, line] of Object.entries(EXPECTED)) {
  test(`voiceErrorLine: ${kind}`, () => {
    assert.equal(voiceErrorLine(kind as VoiceErrorKind), line);
  });
}

test('voiceErrorLine: unsupported and denied differ', () => {
  assert.notEqual(voiceErrorLine('unsupported'), voiceErrorLine('denied'));
});
