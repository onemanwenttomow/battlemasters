import { create } from 'zustand';

interface SettingsStore {
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;

  setMusicVolume: (v: number) => void;
  setSFXVolume: (v: number) => void;
  setMasterVolume: (v: number) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  musicVolume: 0.5,
  sfxVolume: 0.7,
  masterVolume: 1.0,

  setMusicVolume: (v) => set({ musicVolume: v }),
  setSFXVolume: (v) => set({ sfxVolume: v }),
  setMasterVolume: (v) => set({ masterVolume: v }),
}));
