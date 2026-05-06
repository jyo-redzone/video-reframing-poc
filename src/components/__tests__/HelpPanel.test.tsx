import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HelpPanel from '../HelpPanel';
import { SHORTCUTS } from '../../shortcuts';

describe('HelpPanel', () => {
  it('renders 18 shortcut rows (one per consolidated entry)', () => {
    expect(SHORTCUTS).toHaveLength(18);
  });

  it('renders a row for every shortcut description', () => {
    const { getByText } = render(<HelpPanel />);
    for (const shortcut of SHORTCUTS) {
      expect(getByText(shortcut.description)).toBeTruthy();
    }
  });

  it('renders surface section headers', () => {
    const { getByText } = render(<HelpPanel />);
    expect(getByText('Player')).toBeTruthy();
    expect(getByText('Timeline')).toBeTruthy();
    expect(getByText('Bounding Box')).toBeTruthy();
    expect(getByText('Help')).toBeTruthy();
  });

  it('renders kbd chips for key tokens', () => {
    const { container } = render(<HelpPanel />);
    const kbdElements = container.querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThan(0);
  });

  it('renders both key chips and a "/" separator for multi-group rows', () => {
    // seek-ends: keyGroups: [['Home'], ['End']]
    const { getByText, getAllByText } = render(<HelpPanel />);
    expect(getByText('Home')).toBeTruthy();
    expect(getByText('End')).toBeTruthy();
    // '/' separator should appear between groups
    const separators = getAllByText('/');
    expect(separators.length).toBeGreaterThan(0);
  });

  it('seek-ends row contains both Home and End kbd chips', () => {
    const { container } = render(<HelpPanel />);
    const kbdElements = Array.from(container.querySelectorAll('kbd'));
    const texts = kbdElements.map((el) => el.textContent);
    expect(texts).toContain('Home');
    expect(texts).toContain('End');
  });

  it('single-group rows do not render a "/" separator in their key chips area', () => {
    // play-pause has keyGroups: [['Space']] — exactly one group, no '/' needed
    const { getByText } = render(<HelpPanel />);
    const spaceChip = getByText('Space');
    // Walk up to the flex chips container (direct parent of the kbd span)
    const chipsContainer = spaceChip.closest('kbd')?.parentElement?.parentElement;
    expect(chipsContainer).toBeTruthy();
    // The chips container should contain no '/' text nodes
    const separators = Array.from(chipsContainer!.querySelectorAll('span')).filter(
      (el) => el.textContent?.trim() === '/',
    );
    expect(separators).toHaveLength(0);
  });

  it('speed-cycle row shows "Cycle playback speed" with Shift + two alternative chips', () => {
    const { getByText, container } = render(<HelpPanel />);
    // Description updated
    expect(getByText('Cycle playback speed')).toBeTruthy();
    // Find all kbd chips in the speed-cycle row: should be Shift, ',', '.'
    const allKbd = Array.from(container.querySelectorAll('kbd'));
    const texts = allKbd.map((el) => el.textContent);
    expect(texts).toContain('Shift');
    expect(texts).toContain(',');
    expect(texts).toContain('.');
  });

  it('renders all 5 bbox rows', () => {
    const { getByText } = render(<HelpPanel />);
    expect(getByText('Move bbox 1px')).toBeTruthy();
    expect(getByText('Move bbox 10px')).toBeTruthy();
    expect(getByText('Grow / shrink bbox')).toBeTruthy();
    expect(getByText('Grow / shrink bbox (larger step)')).toBeTruthy();
    expect(getByText('Maintain aspect ratio (resize / draw)')).toBeTruthy();
  });

  it('bbox-move row renders 4 arrow chips with no "+" between them', () => {
    const { getByText, container } = render(<HelpPanel />);
    // Locate the row by its description text
    const descEl = getByText('Move bbox 1px');
    const rowEl = descEl.closest('div.flex.items-center');
    expect(rowEl).toBeTruthy();
    // Should have exactly 4 kbd chips
    const chips = rowEl!.querySelectorAll('kbd');
    expect(chips).toHaveLength(4);
    const chipTexts = Array.from(chips).map((el) => el.textContent);
    expect(chipTexts).toEqual(['←', '→', '↑', '↓']);
    // No '+' separator spans inside the row
    const plusSpans = Array.from(rowEl!.querySelectorAll('span')).filter(
      (el) => el.textContent?.trim() === '+',
    );
    expect(plusSpans).toHaveLength(0);
  });

  it('bbox-move-shift row renders 5 chips (Shift + 4 arrows) with exactly one "+"', () => {
    const { getByText } = render(<HelpPanel />);
    const descEl = getByText('Move bbox 10px');
    const rowEl = descEl.closest('div.flex.items-center');
    expect(rowEl).toBeTruthy();
    // 5 kbd chips total: Shift, ←, →, ↑, ↓
    const chips = rowEl!.querySelectorAll('kbd');
    expect(chips).toHaveLength(5);
    const chipTexts = Array.from(chips).map((el) => el.textContent);
    expect(chipTexts).toContain('Shift');
    expect(chipTexts).toContain('←');
    expect(chipTexts).toContain('→');
    expect(chipTexts).toContain('↑');
    expect(chipTexts).toContain('↓');
    // Exactly one '+' separator (between Shift and the arrow group)
    const plusSpans = Array.from(rowEl!.querySelectorAll('span')).filter(
      (el) => el.textContent?.trim() === '+',
    );
    expect(plusSpans).toHaveLength(1);
  });

  it('bbox-scale-shift row renders 3 chips (Shift + ] + [) with exactly one "+"', () => {
    const { getByText } = render(<HelpPanel />);
    const descEl = getByText('Grow / shrink bbox (larger step)');
    const rowEl = descEl.closest('div.flex.items-center');
    expect(rowEl).toBeTruthy();
    // 3 kbd chips: Shift, ], [
    const chips = rowEl!.querySelectorAll('kbd');
    expect(chips).toHaveLength(3);
    const chipTexts = Array.from(chips).map((el) => el.textContent);
    expect(chipTexts).toContain('Shift');
    expect(chipTexts).toContain(']');
    expect(chipTexts).toContain('[');
    // Exactly one '+' separator
    const plusSpans = Array.from(rowEl!.querySelectorAll('span')).filter(
      (el) => el.textContent?.trim() === '+',
    );
    expect(plusSpans).toHaveLength(1);
  });

  it('sections appear in order: Bounding Box, Player, Timeline, Help', () => {
    const { container } = render(<HelpPanel />);
    // Section headers are <p> elements with font-semibold text-text-primary
    const headers = Array.from(
      container.querySelectorAll('p.font-semibold.text-text-primary'),
    ).map((el) => el.textContent);
    expect(headers).toEqual(['Bounding Box', 'Player', 'Timeline', 'Help']);
  });

  it('renders 3 inter-section dividers between the 4 sections', () => {
    const { container } = render(<HelpPanel />);
    // Dividers are plain divs with border-t border-border-subtle and my-3
    const dividers = Array.from(container.querySelectorAll('div.my-3.border-t'));
    expect(dividers).toHaveLength(3);
  });

  it('HelpPanel root div does not have border-t class', () => {
    const { container } = render(<HelpPanel />);
    const root = container.firstElementChild;
    expect(root?.classList.contains('border-t')).toBe(false);
  });
});
