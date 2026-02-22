// Audio manager — Phase 6 full implementation with Howler.js
// For now, a silent stub so the game runs without audio dependencies

export class AudioManager {
  private musicVolume = 0.5;
  private sfxVolume = 0.7;
  private masterVolume = 1.0;

  playMusic(_track: string, _fadeIn?: number): void {
    // Stub — Howler.js integration in Phase 6
  }

  stopMusic(_fadeOut?: number): void {
    // Stub
  }

  playSFX(_effect: string): void {
    // Stub
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = v;
  }

  setMasterVolume(v: number): void {
    this.masterVolume = v;
  }

  dispose(): void {
    // Stub
  }
}
