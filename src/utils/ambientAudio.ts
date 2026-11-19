// Ambient synth playback is disabled so the official YouTube track (YPcpT5qMKj4)
// serves as the single authoritative background music without overlapping audio.

export type AmbientZoneId = 0 | 1 | 2 | 3 | 4 | 5;

export const ZONE_ATMOSPHERE_LABELS: Record<number, string> = {
  0: 'Muzik Rasmi EcoWorld (YouTube)',
  1: 'Muzik Rasmi EcoWorld (YouTube)',
  2: 'Muzik Rasmi EcoWorld (YouTube)',
  3: 'Muzik Rasmi EcoWorld (YouTube)',
  4: 'Muzik Rasmi EcoWorld (YouTube)',
  5: 'Muzik Rasmi EcoWorld (YouTube)',
};

export function unlockAmbientAudio(): void {
  // No-op: YouTube player handles official background music exclusively
}

export function updateAmbientAudioPrefs(_partial: Record<string, unknown>): void {
  // No-op: YouTube player handles official background music exclusively
}
