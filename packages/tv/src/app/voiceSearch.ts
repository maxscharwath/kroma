// Voice search: the design lives here, the microphone does not. A shell
// registers a backend only if its television can actually hear; no backend
// registered means no mic button.
//
// tvOS has no microphone API for third-party apps at all - the Siri Remote's mic
// belongs to the system, and the only speech an app ever receives is dictation
// into one of the platform's own text fields - so Apple TV registers none here
// and dictates through `app/searchShell` instead.

import type { ComponentType } from 'react';

export interface VoiceSessionProps {
  /** Called repeatedly, with partial results as the platform reports them. */
  onText: (text: string) => void;
  /** A final result, a cancel, or a failure. The screen closes the panel on
   * this, so a backend MUST call it exactly once. */
  onDone: () => void;
  locale: string;
}

export interface VoiceSearchBackend {
  /** Cheap, synchronous probe, read on every render of the search screen. */
  available: () => boolean;
  Session: ComponentType<VoiceSessionProps>;
}

let current: VoiceSearchBackend | null = null;

/** Call once at the app root, before the first render. Null removes it. */
export function setVoiceSearchBackend(backend: VoiceSearchBackend | null): void {
  current = backend;
}

/** The registered backend, or null when there is none or it reports itself
 * unavailable. A throwing probe counts as unavailable: a broken capability check
 * must not take the search screen down with it. */
export function voiceSearchBackend(): VoiceSearchBackend | null {
  if (!current) return null;
  try {
    return current.available() ? current : null;
  } catch {
    return null;
  }
}
