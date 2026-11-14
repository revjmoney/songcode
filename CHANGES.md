# SONGCODE 0.3.0 — `cos/next-steps` (local only, 2026-11-14)

Jason asked for the three leftover drafts from 0.2.0, still on this local branch only: no push, no PR, no deploy, and the write-ups in `docs/issues/` were not filed on GitHub.

## 1. Slide import from Guitar Pro and MIDI

- Uploaded Guitar Pro files now recover slide / legato-slide / bend effects. Effects are read from the score (ties merged), stripped before alphaTab's MIDI generator so destination notes are not absorbed into a bend, then overlaid onto the parsed notes.
- The MIDI reader turns pitch-bend events (RPN 0,0 sensitivity, default ±2 semitones) and portamento (CC 65) into the same `slide` / `slideTo` flags. `expandSlides` follows `slideTo` when the next note is missing, so those notes still become feed-rate ramps.
- `bookMidi` writes an RPN 24-semitone range and a pitch-bend ramp for book `~` notes. Shipped `.mid` and `.gp` files for songs that have slides were regenerated (Gymnopédie, Mountain King, Moonlight, Symphony No. 5, Turkish March). Songs without slides are **byte-identical**.
- Default two-axis g-code is unchanged for every book song (including the slide songs, whose ramps already came from the book path in 0.2.0).

## 2. Bounce-box path plot

- A 2D and a rotatable 3D plot under the piano roll show the relative G91 tool path around the song start (zero), the travel box, and the start/end of the envelope.
- Overtravel versus the preset box is warned in the result panel before cycle start.
- The downloaded / copied `.nc` file gets a short comment summary (`SONGCODE travel: …`, `overtravel: none` or the axis that walked out). `songcode().text` itself is left alone so tests and shipped programs stay byte-identical.

## 3. Rotary feed math on mills

- Opt-in checkbox, off by default. When a melody or bass axis is A/B/C, steps are steps/deg, max is deg/min, accel is deg/s², and the travel box is in degrees.
- Conventions: **G93 inverse time** (F = 60 / seconds, the default when the option is on — the safe mixed linear+rotary feed on grbl, Marlin and LinuxCNC), **G94 deg/min** on a rotary-only move (mixed moves still switch to G93), or **G94 path feed** F = hypot(linear, ω · stock radius).
- LinuxCNC still ends with M2; Marlin still has millisecond dwells and no M30. Two-axis X+Y output with the option off is unchanged.

## Tests, version, drafts

- 36 tests, including the new MIDI/GP slide, path-envelope, overtravel, and rotary convention cases. `npm test` and `npm run build` pass.
- Version is 0.3.0. Issue drafts 001–003 are marked done in `docs/issues/`. Drafts 004 (LISTEN vs the planner) and 005 (non-GM drums / SMPTE MIDI) are still open and were not filed.

## Not done, and why

- No push, PR, Pages deploy, or GitHub issues.
- Drafts 004 and 005 were not in this request.

---

# SONGCODE 0.2.0 — `cos/next-steps` (local only, 2026-11-14)

Jason approved the three follow-ups from the repo review. This branch implements them in the local clone only: nothing was pushed, no PR was opened, and the issue write-ups in `docs/issues/` were not filed on GitHub.

## 1. Slides, drums, and a third voice

- Book `~` slides are no longer dropped. `tokens` / `voiceNotes` keep the flag, and `expandSlides` writes a feed-rate ramp into the g-code (log-frequency steps from this note to the next).
- The page loads book songs from the arrangements, not from the MIDI export, so those flags survive.
- Shipped g-code for songs that have slides (Gymnopédie, Mountain King, Moonlight, Symphony No. 5, Turkish March) was regenerated. Songs with no slides (Twinkle, Ode to Joy, Saints, and the rest) are **byte-identical** to 0.1.0.
- REVTURN preset, **opt-in, off by default**:
  - Third voice on C (chuck). Spindle stays off (`M5`). Start/end park moves are still in inches, wrapped around the mm trio program.
  - When a file has GM drums, "Play drums on Z" uses the existing kick/snare strokes under the melody and leaves the bass out.
- Two-axis output remains the default.

## 2. 60-second upload window and a more honest LISTEN

- Dropped MIDI / Guitar Pro files still default to a 60 s window starting 8 s before the melody, but the page now shows a clear notice (for example "Only 0:00–1:00 of this 1:16 song will be converted") and a **Use the whole song** button.
- Book songs still open at full length.
- LISTEN uses each axis's accel (mm/s²) so a slow motor, especially REVTURN Z at 12 mm/s², ramps to pitch instead of jumping. Notes that never arrive are listed in the warnings.

## 3. Safer library path, newer tests, issue drafts

- The hidden `drone` option on `buildSong` no longer emits `M3` / `M5`. A book `drone` pitch can be used as the opt-in C voice instead.
- vitest is 5.1.0 (esbuild 0.28.2 for the peer). `npm audit` is clean. 24 tests, including the new slides / trio / drums / LISTEN / window / no-M3 cases.
- Remaining limitations are drafted in `docs/issues/` (GP/MIDI slides, rotary feed math, travel-path plot, LISTEN vs the planner, non-GM drums / SMPTE MIDI). Not filed.

## Tests and build

```
npm test     # 24 passed, vitest 5.1.0
npm run build
```

Both were run on this branch and passed.

## Not done, and why

- No push, PR, Pages deploy, or GitHub issues.
- Guitar Pro / MIDI slide import is still open (draft 001); only the book path has `~`.
- No bounce-box path plot (draft 003).
- README screenshots 01–09 were not all re-shot; new UI shots are in `docs/screenshots/10-window-notice.png` and `docs/screenshots/11-revturn-extras.png` when the screenshot step succeeds.
