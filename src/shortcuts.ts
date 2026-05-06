export type ShortcutSurface = 'Player' | 'Timeline' | 'Bbox' | 'Help';

export type Shortcut = {
  id: string;
  /** Display tokens, e.g. ['Space'], ['Shift', ','], ['←', '→', '↑', '↓'] */
  keys: string[];
  description: string;
  surface: ShortcutSurface;
};

export const SHORTCUTS: Shortcut[] = [
  // ── Player ──────────────────────────────────────────────────────────
  {
    id: 'play-pause',
    keys: ['Space'],
    description: 'Play / pause',
    surface: 'Player',
  },
  {
    id: 'frame-back',
    keys: [','],
    description: 'Step 1 frame back',
    surface: 'Player',
  },
  {
    id: 'frame-forward',
    keys: ['.'],
    description: 'Step 1 frame forward',
    surface: 'Player',
  },
  {
    id: 'speed-down',
    keys: ['Shift', ','],
    description: 'Speed down',
    surface: 'Player',
  },
  {
    id: 'speed-up',
    keys: ['Shift', '.'],
    description: 'Speed up',
    surface: 'Player',
  },
  {
    id: 'record-toggle',
    keys: ['R'],
    description: 'Record toggle',
    surface: 'Player',
  },
  {
    id: 'record-stop',
    keys: ['Shift', 'R'],
    description: 'Stop recording',
    surface: 'Player',
  },

  // ── Timeline ─────────────────────────────────────────────────────────
  {
    id: 'zoom-in',
    keys: ['='],
    description: 'Timeline zoom in',
    surface: 'Timeline',
  },
  {
    id: 'zoom-out',
    keys: ['-'],
    description: 'Timeline zoom out',
    surface: 'Timeline',
  },
  {
    id: 'zoom-reset',
    keys: ['0'],
    description: 'Timeline zoom reset',
    surface: 'Timeline',
  },
  {
    id: 'seek-start',
    keys: ['Home'],
    description: 'Seek to clip start',
    surface: 'Timeline',
  },
  {
    id: 'seek-end',
    keys: ['End'],
    description: 'Seek to clip end',
    surface: 'Timeline',
  },
  {
    id: 'set-in-point',
    keys: ['I'],
    description: 'Set in-point',
    surface: 'Timeline',
  },
  {
    id: 'set-out-point',
    keys: ['O'],
    description: 'Set out-point',
    surface: 'Timeline',
  },
  {
    id: 'delete-keyframe',
    keys: ['Delete', 'Backspace'],
    description: 'Delete selected keyframe',
    surface: 'Timeline',
  },
  {
    id: 'close-popover',
    keys: ['Esc'],
    description: 'Close popover / dialog',
    surface: 'Timeline',
  },

  // ── Bbox ─────────────────────────────────────────────────────────────
  {
    id: 'bbox-move-1px',
    keys: ['←', '→', '↑', '↓'],
    description: 'Move bbox 1px',
    surface: 'Bbox',
  },
  {
    id: 'bbox-move-10px',
    keys: ['Shift', '←/→/↑/↓'],
    description: 'Move bbox 10px',
    surface: 'Bbox',
  },
  {
    id: 'bbox-grow',
    keys: [']'],
    description: 'Grow bbox',
    surface: 'Bbox',
  },
  {
    id: 'bbox-shrink',
    keys: ['['],
    description: 'Shrink bbox',
    surface: 'Bbox',
  },
  {
    id: 'bbox-grow-large',
    keys: ['Shift', ']'],
    description: 'Grow bbox (larger step)',
    surface: 'Bbox',
  },
  {
    id: 'bbox-shrink-large',
    keys: ['Shift', '['],
    description: 'Shrink bbox (larger step)',
    surface: 'Bbox',
  },
  {
    id: 'bbox-drag-constrain',
    keys: ['Shift'],
    description: 'Axis / square constraint (drag)',
    surface: 'Bbox',
  },

  // ── Help ─────────────────────────────────────────────────────────────
  {
    id: 'toggle-help',
    keys: ['?'],
    description: 'Toggle keyboard shortcuts panel',
    surface: 'Help',
  },
];
