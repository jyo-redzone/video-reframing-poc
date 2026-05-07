import { TIMELINE_POPOVER_WIDTH } from '../../config';

type Props = {
  activeTransition: 'smooth' | 'cut' | null;
  popoverLeft: number;
  popoverArrowLeft: number;
  onSelect: (transition: 'smooth' | 'cut') => void;
};

export default function TransitionPicker({ activeTransition, popoverLeft, popoverArrowLeft, onSelect }: Props) {
  const smoothActive = activeTransition === 'smooth';
  const cutActive = activeTransition === 'cut';

  return (
    <div
      id="tl-transition-picker"
      className="absolute z-20 flex items-center gap-2 p-1.5 rounded border border-white/30 bg-[#1f2b3a] shadow-elevation-8 whitespace-nowrap"
      style={{
        left: popoverLeft,
        maxWidth: `calc(100% - ${popoverLeft + 4}px)`,
        bottom: 'calc(100% + 6px)',
      }}
    >
      <span className="px-1 text-xs uppercase tracking-button text-text-secondary">Transition</span>
      <button
        className={`px-2 py-1 text-xs rounded border ${
          smoothActive
            ? 'border-sky-400 bg-[rgba(56,189,248,0.45)] text-white font-medium'
            : 'border-sky-400/40 text-sky-300 hover:bg-sky-400/10'
        }`}
        tabIndex={-1}
        onClick={() => onSelect('smooth')}
      >
        Smooth
      </button>
      <button
        className={`px-2 py-1 text-xs rounded border ${
          cutActive
            ? 'border-orange-400 bg-[rgba(251,146,60,0.45)] text-white font-medium'
            : 'border-orange-400/40 text-orange-300 hover:bg-orange-400/10'
        }`}
        tabIndex={-1}
        onClick={() => onSelect('cut')}
      >
        Cut
      </button>
      {/* Chevron pointing down to the active segment */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: popoverArrowLeft - 6,
          top: '100%',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid rgba(255,255,255,0.3)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: popoverArrowLeft - 5,
          top: '100%',
          marginTop: -1,
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `5px solid #1f2b3a`,
        }}
      />
    </div>
  );
}

// Keep the constant accessible from the same module for popoverLeft calculations in the shell
export { TIMELINE_POPOVER_WIDTH };
