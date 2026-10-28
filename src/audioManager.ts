/**
 * AudioManager - Gestionnaire d'effets sonores (SFX) pour Renard et Spectre
 *
 * Joue UNIQUEMENT les fichiers audio réels déposés par l'utilisateur (aucun bruit bizarre synthétique).
 * Emplacements supportés :
 * - public/audio/sfx/renard.mp3 (ou dans public/audio/sfx/renards/)
 * - public/audio/sfx/fantome.mp3 (ou dans public/audio/sfx/fantomes/)
 * - public/audio/sfx/grabuge.mp3 (ou dans public/audio/sfx/grabuge/)
 */

export type SFXType = 'renard' | 'fantome' | 'grabuge';

export interface PlaySFXOptions {
  volume?: number;
  force?: boolean;
}

// Candidates d'URL directes et sous-dossiers pour chaque effet
const SFX_CANDIDATES: Record<SFXType, string[]> = {
  renard: [
    '/api/sfx-audio/renards',
    '/audio/sfx/renards/renards.mp3',
    '/audio/sfx/renard.mp3',
    '/audio/sfx/renards.mp3',
    '/audio/sfx/renards/renard.mp3',
    '/audio/sfx/renards.wav',
    '/audio/sfx/renard.wav',
  ],
  fantome: [
    '/api/sfx-audio/fantomes',
    '/audio/sfx/fantomes/fantomes.mp3',
    '/audio/sfx/fantome.mp3',
    '/audio/sfx/fantomes.mp3',
    '/audio/sfx/fantomes/fantome.mp3',
    '/audio/sfx/fantomes.wav',
    '/audio/sfx/fantome.wav',
  ],
  grabuge: [
    '/api/sfx-audio/grabuge',
    '/audio/sfx/grabuge/grabuge.mp4',
    '/audio/sfx/grabuge/WhatsApp Video 2026-10-25 at 17.06.52 (2).mp4',
    '/audio/sfx/grabuge/grabuge.mp3',
    '/audio/sfx/grabuge.mp4',
    '/audio/sfx/grabuge.mp3',
    '/audio/sfx/grabuge/grabuge.wav',
  ],
};

let dynamicManifest: Record<string, { url?: string | null; filename?: string | null; exists?: boolean }> | null = null;
let activeAudios: HTMLAudioElement[] = [];

export async function refreshSfxManifest(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch(`/api/sfx-files?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      dynamicManifest = await res.json();
      return;
    }
  } catch (_) {}

  try {
    const resFallback = await fetch(`/audio/sfx.json?t=${Date.now()}`, { cache: 'no-store' });
    if (resFallback.ok) {
      dynamicManifest = await resFallback.json();
    }
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  refreshSfxManifest();
}

/**
 * Vérifie si les effets sonores sont activés dans les réglages utilisateur
 */
function isSFXEnabled(type: SFXType): boolean {
  try {
    const raw = localStorage.getItem('rs_sfx_settings');
    if (!raw) return true;
    const settings = JSON.parse(raw);
    if (settings.enabled === false) return false;
    if (type === 'renard' && settings.foxEliminated === false) return false;
    if (type === 'fantome' && settings.ghostEliminated === false) return false;
    if (type === 'grabuge' && settings.playerEliminated === false) return false;
    return true;
  } catch (_) {
    return true;
  }
}

/**
 * Joue uniquement les fichiers audio réels déposés par l'utilisateur.
 * Si aucun fichier n'existe, ne fait aucun son bizarre.
 */
export async function playSFX(type: SFXType, options?: PlaySFXOptions): Promise<boolean> {
  const force = options?.force ?? false;
  if (!force && !isSFXEnabled(type)) {
    return false;
  }

  if (typeof window === 'undefined') return false;

  const manifestKey = type === 'renard' ? 'renards' : (type === 'fantome' ? 'fantomes' : 'grabuge');
  const detectedUrl = dynamicManifest?.[manifestKey]?.url;

  const candidateUrls: string[] = [];
  if (detectedUrl) {
    candidateUrls.push(encodeURI(detectedUrl));
  }
  SFX_CANDIDATES[type].forEach(u => {
    const encoded = encodeURI(u);
    if (!candidateUrls.includes(encoded)) {
      candidateUrls.push(encoded);
    }
  });

  const targetVolume = Math.max(0, Math.min(1, options?.volume ?? 0.8));

  for (const url of candidateUrls) {
    try {
      const audio = new Audio(url);
      audio.volume = targetVolume;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        activeAudios.push(audio);
        audio.onended = () => {
          activeAudios = activeAudios.filter(a => a !== audio);
        };
        return true;
      }
    } catch (_) {
      // Échec de cette URL, tester la suivante
    }
  }

  // Aucun son bizarre synthétique : si pas de fichier, silence respecté
  return false;
}

export function stopSFX(): void {
  activeAudios.forEach(a => {
    try {
      a.pause();
      a.currentTime = 0;
    } catch (_) {}
  });
  activeAudios = [];
}

export const playRenard = (options?: PlaySFXOptions) => playSFX('renard', options);
export const playFantome = (options?: PlaySFXOptions) => playSFX('fantome', options);
export const playGrabuge = (options?: PlaySFXOptions) => playSFX('grabuge', options);

export default {
  playSFX,
  playRenard,
  playFantome,
  playGrabuge,
  stopSFX,
  refreshSfxManifest,
};
