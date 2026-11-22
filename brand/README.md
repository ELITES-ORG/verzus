# verzus mark

The "v" of the wordmark is the logo. It is Dela Gothic One's lowercase v (same width, x-height and
baseline, so it sets in line with "erzus") split into two bars:

- **Green bar** `#22c55e`, in front: it runs straight through the vertex and cuts the other bar on a
  diagonal, the same cut as the landing page's hero panel. Two sides clashing.
- **Side bar**: violet `#5a4fd8` on light grounds, lavender `#b8b3ff` on dark ones.

It follows the structure of the earlier interim mark (two bars meeting in a V), redrawn in this
project's palette, without that mark's dot.

## Colour

Green is the verzus colour and means go: the logo's front bar, main buttons, what's chosen or done.
Red means danger (errors, missing fields, delete) and nothing else. The shared tokens are in
`packages/tailwind/colors.js`:

- `#22c55e` (brand-500): the logo and marks with no text on them.
- `#15803d` (brand-600): white text on green (5.0:1, WCAG AA) and green text on light grounds.
- `#5a4fd8` / `#b8b3ff` (violet): the logo's second bar, and in the interface focus and "you are
  here". Red (danger) means errors and deletes only.

| File                      | Use                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `verzus-mark.svg`         | The mark on light backgrounds                                                             |
| `verzus-mark-on-dark.svg` | The mark on ink or other dark backgrounds                                                 |
| `verzus-icon.svg`         | Favicon: rounded ink tile (landing page, venue dashboard)                                 |
| `verzus-app-icon.svg`     | Home-screen / store icon, full-bleed ink (the OS applies the mask)                        |
| `verzus-maskable.svg`     | PWA maskable icon: mark kept inside the safe zone                                         |
| `verzus-foreground.svg`   | Android adaptive icon foreground (background is solid ink)                                |
| `verzus-monochrome.svg`   | Android themed icon; the seam between the bars is cut out so it still reads in one colour |

The player app's PNGs (`apps/player/assets/images/*`, `apps/player/public/icon-*.png`) are renders of
these files. If the mark changes, re-render them at the same sizes rather than editing the PNGs.

In the landing page the mark is inline SVG inside `.wordmark`; its colours come from CSS
(`--accent-bright`, and `--mark-side`, which switches to lavender in the footer).
