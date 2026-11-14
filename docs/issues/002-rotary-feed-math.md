# Rotary axes (A/B/C) on a mill still use linear feed math

**Type:** bug / caveat
**Area:** `src/music/arrange.js` `machineOf`, `src/music/build.js` `buildSong`

## What's going on

The page lets you pick A, B or C as one of the two song axes. Pitch is computed as if `steps/mm` were a linear steps-per-millimetre (or steps-per-inch) figure, and the path feed is `hypot` of the two axis speeds treated as linear.

That is correct for X/Y/Z. It is not correct for a rotary axis:

- Firmware `$103` (and friends) is usually **steps per degree**, not per mm.
- Path `F` on a move that includes a rotary is not "mm/min of hypot(X, A)" in the same units, and some controllers treat a C-only move as deg/min.

The REVTURN **opt-in third voice** already uses the measured chuck numbers (steps/deg, deg/min, deg/s²) inside `buildTrio`. That path is lathe-specific and does not fix a mill user who simply picks axis `A` in the two-axis form.

## Suggested work

- When the selected letter is A/B/C, treat the steps field as steps/deg (and say so in the table header).
- Use the same C-axis timing rules already documented in `buildTrio` for a rotary song axis, or refuse the combination with a clear warning until that is done.

## Workaround

Leave A/B/C unselected unless you really have measured what your controller does with mixed linear+rotary `F` words, and you have entered steps so the resulting Hz is the pitch you want.
