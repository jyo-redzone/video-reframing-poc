export type ShortcutSurface = 'Player' | 'Timeline' | 'Bbox' | 'Help';

export type Shortcut = {
  id: string;
  /**
   * Each inner array is one binding. Within a binding, items separate with '+':
   *   - string item → one chip
   *   - string[] item → multiple alternative chips rendered with no separator
   * Multiple bindings (top-level groups) render separated by '/'.
   */
  keyGroups: (string | string[])[][];
  description: string;
  surface: ShortcutSurface;
};

export const SHORTCUTS: Shortcut[] = [
  // ── Player ──────────────────────────────────────────────────────────
  {
    id: 'play-pause',
    keyGroups: [['Space']],
    description: 'Play / pause',
    surface: 'Player',
  },
  {
    id: 'second-step',
    keyGroups: [[','], ['.']],
    description: 'Step 1 second back / forward',
    surface: 'Player',
  },
  {
    id: 'speed-cycle',
    keyGroups: [['Shift', [',', '.']]],
    description: 'Playback speed',
    surface: 'Player',
  },
  {
    id: 'record-toggle',
    keyGroups: [['R']],
    description: 'Record toggle',
    surface: 'Player',
  },
  {
    id: 'record-stop',
    keyGroups: [['Shift', 'R']],
    description: 'Stop recording',
    surface: 'Player',
  },
  {
    id: 'mode-toggle',
    keyGroups: [['M']],
    description: 'Toggle mode (edit / view)',
    surface: 'Player',
  },

  // ── Timeline ─────────────────────────────────────────────────────────
  {
    id: 'zoom',
    keyGroups: [['='], ['-']],
    description: 'Timeline zoom in / out',
    surface: 'Timeline',
  },
  {
    id: 'zoom-reset',
    keyGroups: [['0']],
    description: 'Reset timeline zoom',
    surface: 'Timeline',
  },
  {
    id: 'seek-ends',
    keyGroups: [['Home'], ['End']],
    description: 'Seek to clip start / end',
    surface: 'Timeline',
  },
  {
    id: 'in-out-point',
    keyGroups: [['I'], ['O']],
    description: 'Set clip start / end',
    surface: 'Timeline',
  },
  {
    id: 'delete-keyframe',
    keyGroups: [['Delete'], ['Backspace']],
    description: 'Delete selected keyframe',
    surface: 'Timeline',
  },
  {
    id: 'close-popover',
    keyGroups: [['Esc']],
    description: 'Close popover / dialog',
    surface: 'Timeline',
  },

  // ── Bbox ─────────────────────────────────────────────────────────────
  { id: 'bbox-move',        keyGroups: [[['←', '→', '↑', '↓']]],          description: 'Move bbox',                    surface: 'Bbox' },
  { id: 'bbox-move-shift',  keyGroups: [['Shift', ['←', '→', '↑', '↓']]], description: 'Move bbox (larger step)',                   surface: 'Bbox' },
  { id: 'bbox-scale',       keyGroups: [[']'], ['[']],                      description: 'Grow / shrink bbox',               surface: 'Bbox' },
  { id: 'bbox-scale-shift', keyGroups: [['Shift', [']', '[']]],             description: 'Grow / shrink bbox (larger step)', surface: 'Bbox' },
  { id: 'bbox-constrain',   keyGroups: [['Shift']],               description: 'Maintain aspect ratio',  surface: 'Bbox' },

  // ── Help ─────────────────────────────────────────────────────────────
  {
    id: 'toggle-help',
    keyGroups: [['?']],
    description: 'Toggle keyboard shortcuts panel',
    surface: 'Help',
  },
];
