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
