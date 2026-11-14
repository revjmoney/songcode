# DONE in 0.4.0 (local `cos/next-steps`, 2026-11-14) — LISTEN matches the motion planner

This draft was implemented on the local branch. It was **not** filed on GitHub.

---

# LISTEN models per-axis accel, not the full motion planner

**Type:** caveat
**Area:** `src/music/listen.js`

## What works now

LISTEN ramps each motor from the previous pitch (or from a stop, on a re-strike or a rest) using that axis's accel in mm/s², so a slow axis such as REVTURN Z at 12 mm/s² takes time to arrive, as it does on the iron. Notes shorter than the ramp are flagged in the warning list.

## What's still missing

This is not a copy of the grblHAL (or LinuxCNC, or Marlin) planner:

- No jerk / junction deviation / blending at direction changes.
- No coupled-path accel (the g-code shortens a combined move by `F/a` of the slowest axis; LISTEN ramps each voice on its own clock).
- No motor skipped-step or resonance model.
- Ramping an oscillator to 20 Hz instead of 0 is an audio floor, not a mechanical one.

On a well-tuned machine with long notes, LISTEN is close. On short, fast notes, or right after a reversal, the iron can still sound different. Trust the first 10–15 second test cut (with nothing in the machine) more than the browser.

## Suggested work

Optional: drive LISTEN from the same slice times and `fromStop` shortening that `buildSong` already computes, so the preview and the program share one timeline. A full planner port is not needed.


## Resolution (0.4.0)

LISTEN plans the generated g-code with a grbl-style trapezoid, junction deviation, lookahead, and per-axis max/accel (`src/music/planner.js`). The preview follows those axis velocities. Moves that never cruise at the written feed are warned. Junction deviation is per preset (and editable) and does not change the g-code. Hand-computed tests are in `test/songcode.test.js`.
