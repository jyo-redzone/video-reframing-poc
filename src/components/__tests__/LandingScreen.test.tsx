import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingScreen from '../LandingScreen';
import useAppStore from '../../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ videoUrl: null, videoMetadata: null });
});

describe('LandingScreen', () => {
  it('renders the HLS URL and FPS inputs', () => {
    render(<LandingScreen />);
    expect(screen.getByLabelText(/HLS URL/i)).toBeTruthy();
    expect(screen.getByLabelText(/frames per second/i)).toBeTruthy();
  });

  it('Load button is disabled when URL is empty', () => {
    render(<LandingScreen />);
    const btn = screen.getByRole('button', { name: /load/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Load button becomes enabled when URL is entered', () => {
    render(<LandingScreen />);
    const urlInput = screen.getByLabelText(/HLS URL/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/stream.m3u8' } });
    const btn = screen.getByRole('button', { name: /load/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('submitting the form sets videoUrl in the store', () => {
    render(<LandingScreen />);
    const urlInput = screen.getByLabelText(/HLS URL/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/stream.m3u8' } });
    fireEvent.click(screen.getByRole('button', { name: /load/i }));
    expect(useAppStore.getState().videoUrl).toBe('https://example.com/stream.m3u8');
  });

  it('submitting the form seeds fps into videoMetadata', () => {
    render(<LandingScreen />);
    const urlInput = screen.getByLabelText(/HLS URL/i);
    const fpsInput = screen.getByLabelText(/frames per second/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/stream.m3u8' } });
    fireEvent.change(fpsInput, { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /load/i }));
    expect(useAppStore.getState().videoMetadata?.fps).toBe(60);
  });

  it('FPS defaults to 29.97', () => {
    render(<LandingScreen />);
    const fpsInput = screen.getByLabelText(/frames per second/i) as HTMLInputElement;
    expect(parseFloat(fpsInput.value)).toBeCloseTo(29.97);
  });
});
