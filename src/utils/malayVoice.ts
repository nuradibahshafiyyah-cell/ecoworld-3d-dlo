export const MALAYSIAN_TTS_STYLE_DIRECTIVE =
  'Speak strictly in standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia, locale ms-MY, Kuala Lumpur / RTM broadcast accent). NEVER use an Indonesian (id-ID / Jakarta) accent, intonation, or pronunciation. Use clear, natural, warm, friendly, and cheerful Malaysian intonation suitable for Year 6 Malaysian primary school pupils.';

export function buildMalaysianTtsStyle(sceneStyle?: string): string {
  const extra = (sceneStyle || '').trim();
  if (!extra) return MALAYSIAN_TTS_STYLE_DIRECTIVE;
  return `${MALAYSIAN_TTS_STYLE_DIRECTIVE} ${extra}`;
}

const INDONESIAN_VOICE_RE =
  /indonesia|\bid[-_]?id\b|bahasa indonesia|gadis|damayanti|andika|indri|ardi|putri|sari/i;
const MALAY_NAME_RE = /\bmalay\b|bahasa melayu|\bms[-_]?my\b|yasmin|osman/i;
const MALE_MS_VOICE_RE = /osman|farid|adam|david|mark|daniel|rishi|alex|fred|george|guy|ryan|\bmale\b|lelaki/i;
const FEMALE_MS_VOICE_RE = /yasmin|amira|siti|nur|ain|zura|puteri|rina|female|woman|girl|ms-my-x-ms[bc]/i;

export function isStrictMalaysianMalayVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = (voice.lang || '').toLowerCase();
  const name = (voice.name || '').toLowerCase();
  if (lang.startsWith('id') || INDONESIAN_VOICE_RE.test(name)) {
    return false;
  }
  return lang.startsWith('ms') || MALAY_NAME_RE.test(name);
}

/**
 * Selects ONLY a verified Malaysian Bahasa Melayu (ms-MY / ms) browser voice.
 * Strictly NEVER falls back to Indonesian (id-ID) or English voices.
 */
export function pickMalaysianSpeechVoice(
  voices: SpeechSynthesisVoice[],
  options?: { preferFemale?: boolean }
): { voice: SpeechSynthesisVoice | null; isConfirmedFemale: boolean } {
  if (!voices || voices.length === 0) {
    return { voice: null, isConfirmedFemale: false };
  }

  const msPool = voices.filter(isStrictMalaysianMalayVoice);
  if (msPool.length === 0) {
    return { voice: null, isConfirmedFemale: false };
  }

  const msMyPool = msPool.filter((v) => v.lang.toLowerCase().startsWith('ms-my'));
  const prioritizedPool = msMyPool.length > 0 ? msMyPool : msPool;

  if (options?.preferFemale) {
    const nonMale = prioritizedPool.filter((v) => !MALE_MS_VOICE_RE.test(v.name));
    const confirmedFemale = nonMale.find((v) => FEMALE_MS_VOICE_RE.test(v.name));
    if (confirmedFemale) {
      return { voice: confirmedFemale, isConfirmedFemale: true };
    }
    if (nonMale.length > 0) {
      return { voice: nonMale[0], isConfirmedFemale: false };
    }
  } else {
    const femalePreferred = prioritizedPool.find(
      (v) => !MALE_MS_VOICE_RE.test(v.name) && FEMALE_MS_VOICE_RE.test(v.name)
    );
    if (femalePreferred) {
      return { voice: femalePreferred, isConfirmedFemale: true };
    }
  }

  return { voice: prioritizedPool[0], isConfirmedFemale: false };
}
