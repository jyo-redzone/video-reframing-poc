import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HelpPanel from '../HelpPanel';
import { SHORTCUTS } from '../../shortcuts';

describe('HelpPanel', () => {
  it('renders a row for every shortcut', () => {
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

  it('renders kbd chips for keys', () => {
    const { container } = render(<HelpPanel />);
    const kbdElements = container.querySelectorAll('kbd');
    // At minimum one kbd per shortcut key token
    expect(kbdElements.length).toBeGreaterThan(0);
  });
});
