/** Types for themes.js: the verzus palette as RGB channels ("21 128 61"). */
export type ThemeToken =
  | 'canvas'
  | 'surface'
  | 'surface-2'
  | 'surface-3'
  | 'line'
  | 'line-strong'
  | 'fg'
  | 'fg-2'
  | 'fg-3'
  | 'accent'
  | 'accent-hover'
  | 'on-accent'
  | 'accent-soft'
  | 'accent-soft-fg'
  | 'mark'
  | 'violet'
  | 'violet-soft'
  | 'danger'
  | 'danger-soft'
  | 'warn'
  | 'warn-soft'
  | 'scrim';
export type Theme = Record<ThemeToken, string>;
export declare const light: Theme;
export declare const dark: Theme;
/** { canvas: '245 245 249' } -> { '--canvas': '245 245 249' } */
export declare function asVars(theme: Theme): Record<`--${ThemeToken}`, string>;
/** A token as a React Native colour: 'rgb(21, 128, 61)'. */
export declare function rgb(theme: Theme, name: ThemeToken): string;
