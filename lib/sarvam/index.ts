import type { VoiceLane } from '../contracts';
import { transcribe } from './transcribe';
import { extract } from './extract';
import { speak } from './speak';
export const sarvamLane: VoiceLane = { transcribe, extract, speak };
