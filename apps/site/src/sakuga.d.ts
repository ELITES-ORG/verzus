/** The parts of Sakuga VFX's global API this page uses (see public/sakuga-vfx). */

type SakugaWord = 'don' | 'kachi' | 'shu' | 'pon' | 'zuza' | 'gogo';
type Point = { x: number; y: number; w: number; h: number };

interface SakugaFX {
  /** Effects palette. Mutable: the drawing code reads it every frame. */
  readonly P: { fill: string; shade: string; line: string; accent: string; ink: string; sfx: [string, string] };
  at(el: Element, fx?: number, fy?: number): Point;
  burst(x: number, y: number, opts?: { r?: number; spikes?: number; life?: number }): void;
  puff(
    x: number,
    y: number,
    opts?: { n?: number; size?: number; vx?: number; vy?: number; life?: number; spread?: number },
  ): void;
  shards(x: number, y: number, opts?: { n?: number; speed?: number; size?: number; dir?: number; arc?: number }): void;
  kira(x: number, y: number, opts?: { r?: number; life?: number }): void;
  sfx(name: SakugaWord, x: number, y: number, opts?: { size?: number; rot?: number; life?: number }): void;
  later(ms: number, fn: () => void): void;
}

interface SakugaProgressElement extends HTMLElement {
  set(value: number, instant?: boolean): void;
  reset(): void;
}
interface SakugaToastElement extends HTMLElement {
  show(message?: string): void;
}
interface SakugaValueElement extends HTMLElement {
  value: string;
}
interface SakugaSliderElement extends SakugaValueElement {
  readonly valueAsNumber: number;
}
interface SakugaCheckboxElement extends HTMLElement {
  checked: boolean;
}

interface Window {
  SakugaFX?: SakugaFX;
}
