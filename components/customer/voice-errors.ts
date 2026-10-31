import type { RecorderErrorKind } from '@/components/VoiceRecorder';

export type VoiceErrorKind = RecorderErrorKind | 'in_app' | 'empty' | 'server';

const LINES: Record<VoiceErrorKind, string> = {
  unsupported: 'Is browser mein mic nahi chalta. Neeche likh ke batayein.',
  in_app: 'App ke andar wale browser mein mic nahi chalta. Safari ya Chrome mein kholein, ya neeche likhein.',
  denied: 'Mic ki permission nahi mili. Settings mein mic allow karein, ya neeche likhein.',
  no_audio: 'Mic se awaaz nahi aayi. Dobara tap karein, ya neeche likhein.',
  too_short: 'Bahut chhota tha. Tap karke poori baat bolein.',
  empty: 'Awaaz samajh nahi aayi. Dobara bolein, ya neeche likhein.',
  server: 'Awaaz abhi nahi chal rahi. Neeche likh ke batayein.',
  failed: 'Awaaz abhi nahi chal rahi. Neeche likh ke batayein.',
};

export function voiceErrorLine(kind: VoiceErrorKind): string {
  return LINES[kind];
}
