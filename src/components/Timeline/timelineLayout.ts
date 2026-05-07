import { TL_X0, TL_X1 } from '../../config';

export function xFor(time: number, visibleStart: number, visibleDuration: number): number {
  return TL_X0 + ((time - visibleStart) / visibleDuration) * (TL_X1 - TL_X0);
}

export function timeFromClientX(
  clientX: number,
  svg: SVGSVGElement,
  visibleStart: number,
  visibleDuration: number,
  duration: number,
): number {
  const ctm = svg.getScreenCTM();
  if (!ctm) return 0;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = 0;
  const svgPt = pt.matrixTransform(ctm.inverse());
  const ratio = (svgPt.x - TL_X0) / (TL_X1 - TL_X0);
  return Math.max(0, Math.min(duration, visibleStart + ratio * visibleDuration));
}

export function formatTickLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getTickInterval(visibleDuration: number, targetTicks = 8): number {
  const raw = visibleDuration / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
