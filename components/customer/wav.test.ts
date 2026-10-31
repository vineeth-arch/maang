import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav } from './wav';

test('encodeWav: 1 s of 48 kHz input becomes a 16 kHz mono PCM16 WAV', () => {
  const input = new Float32Array(48000);
  for (let i = 0; i < input.length; i++) input[i] = Math.sin((2 * Math.PI * 440 * i) / 48000) * 0.5;
  const buf = encodeWav(input, 48000);
  const dv = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  assert.equal(tag(0), 'RIFF');
  assert.equal(tag(8), 'WAVE');
  assert.equal(tag(12), 'fmt ');
  assert.equal(dv.getUint16(20, true), 1);
  assert.equal(dv.getUint16(22, true), 1);
  assert.equal(dv.getUint32(24, true), 16000);
  assert.equal(dv.getUint16(34, true), 16);
  assert.equal(tag(36), 'data');
  assert.equal(dv.getUint32(40, true), 16000 * 2);
  assert.equal(buf.byteLength, 44 + 32000);
  assert.equal(dv.getUint32(4, true), buf.byteLength - 8);
});
