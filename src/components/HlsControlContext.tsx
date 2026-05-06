import { createContext, useContext } from 'react';

export type HlsLevel = {
  index: number;
  height: number;
  bitrate: number;
};

export type HlsControl = {
  levels: HlsLevel[];
  currentLevel: number; // -1 = auto
  setLevel: (level: number) => void;
};

const DEFAULT: HlsControl = {
  levels: [],
  currentLevel: -1,
  setLevel: () => {},
};

const HlsControlContext = createContext<HlsControl>(DEFAULT);

export const HlsControlProvider = HlsControlContext.Provider;

export function useHlsControl(): HlsControl {
  return useContext(HlsControlContext);
}
