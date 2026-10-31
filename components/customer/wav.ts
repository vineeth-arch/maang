export const TARGET_RATE = 16000;

/** Downsample mono float samples to 16 kHz (box average when shrinking) and wrap as 16-bit PCM WAV. */
export function encodeWav(input: Float32Array, inRate: number): ArrayBuffer {
  const ratio = inRate / TARGET_RATE;
  const outLen = ratio > 1 ? Math.floor(input.length / ratio) : input.length;
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    let v: number;
    if (ratio > 1) {
      const start = Math.floor(i * ratio);
      const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j++) sum += input[j];
      v = sum / (end - start);
    } else {
      v = input[i];
    }
    const s = Math.max(-1, Math.min(1, v));
    pcm[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }

  const dataLen = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  dv.setUint32(4, 36 + dataLen, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, TARGET_RATE, true);
  dv.setUint32(28, TARGET_RATE * 2, true); // byte rate
  dv.setUint16(32, 2, true); // block align
  dv.setUint16(34, 16, true); // bits
  str(36, 'data');
  dv.setUint32(40, dataLen, true);
  for (let i = 0; i < pcm.length; i++) dv.setInt16(44 + i * 2, pcm[i], true);
  return buf;
}

/** Duration in ms of a PCM WAV, read from its header. Null when the bytes are not a well-formed RIFF/WAVE. */
export function wavDurationMs(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  const channels = dv.getUint16(22, true);
  const rate = dv.getUint32(24, true);
  const bits = dv.getUint16(34, true);
  const bytesPerSec = rate * channels * (bits / 8);
  if (!(bytesPerSec > 0)) return null;
  let off = 12;
  while (off + 8 <= bytes.length) {
    const size = dv.getUint32(off + 4, true);
    if (tag(off) === 'data') {
      const avail = bytes.length - (off + 8);
      return Math.round((Math.min(size, avail) / bytesPerSec) * 1000);
    }
    off += 8 + size + (size & 1);
  }
  return null;
}
