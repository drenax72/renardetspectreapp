import { useCallback } from 'react';
import {
  playSFX as corePlaySFX,
  playRenard as corePlayRenard,
  playFantome as corePlayFantome,
  playGrabuge as corePlayGrabuge,
  stopSFX as coreStopSFX,
  refreshSfxManifest as coreRefreshSfxManifest,
  PlaySFXOptions,
  SFXType,
} from './audioManager';

export {
  corePlaySFX as playSFX,
  corePlayRenard as playRenard,
  corePlayFantome as playFantome,
  corePlayGrabuge as playGrabuge,
  coreStopSFX as stopSFX,
  coreRefreshSfxManifest as refreshSfxManifest,
};
export type { SFXType, PlaySFXOptions };

export function useSFX() {
  const playRenard = useCallback((options?: PlaySFXOptions) => corePlayRenard(options), []);
  const playFantome = useCallback((options?: PlaySFXOptions) => corePlayFantome(options), []);
  const playGrabuge = useCallback((options?: PlaySFXOptions) => corePlayGrabuge(options), []);
  const playSFX = useCallback((type: SFXType, options?: PlaySFXOptions) => corePlaySFX(type, options), []);
  const stopSFX = useCallback(() => coreStopSFX(), []);
  const refreshSfx = useCallback(() => coreRefreshSfxManifest(), []);

  return {
    playRenard,
    playFantome,
    playGrabuge,
    playSFX,
    stopSFX,
    refreshSfx,
  };
}

export default useSFX;
