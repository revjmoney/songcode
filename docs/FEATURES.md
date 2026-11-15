# SONGCODE features and settings log

## Features

| Feature | Status |
|---|---|
| Open Guitar Pro .gp3/.gp4/.gp5/.gpx/.gp (alphaTab importer, repeats played out, tempo changes kept) | done 2026-11-12 |
| Open MIDI .mid (format 0 and 1, tempo map, drums on channel 10 left out) | done 2026-11-12 |
| Auto pick: melody (vocal/lead names, most single-note), bass (named bass or lowest), fill (most single-note other) | done 2026-11-12 |
| Fill plays only in melody rests longer than "fill gap" | done 2026-11-12 |
| Section from/to, repeat, speed %, transpose, octave fitting per motor | done 2026-11-12 |
| Machine presets: REVTURN lathe, grbl mill/router X+Y, Marlin 3D printer X+Y, LinuxCNC mill X+Y, Custom | done 2026-11-12 |
| Any two axes (X Y Z A B C), mm or inch, lathe diameter words + G7, N numbers on/off, start / end code | done 2026-11-12 |
| Flavors: grbl/grblHAL (G4 P sec, M30), LinuxCNC (M2), Marlin (G4 P ms, no N, no M30) | done 2026-11-12 |
| LISTEN (square-wave preview at the machine's pitches), notes plot, stats, travel check, download, copy | done 2026-11-12 |
| Machine settings remembered in the browser (localStorage) | done 2026-11-12 |
| Free song book: 13 public-domain tunes arranged by JMSCNC, as MIDI, Guitar Pro tab and g-code | done 2026-11-12 |
| One-file build (dist/index.html), GitHub Pages workflow | done 2026-11-12 |

## Settings (preset defaults)

| Preset | Axes | Steps/mm | Micro | Max mm/min | Accel mm/s2 | Travel | Units |
|---|---|---|---|---|---|---|---|
| REVTURN lathe | X / Z | 800 / 1932 | 16 / 32 | 1016 / 558.8 | 50 / 12 | 0.65 / 0.4 in | in, diameter, G7 |
| grbl mill / router | X / Y | 80 / 80 | 16 / 16 | 3000 | 200 | 20 mm | mm |
| 3D printer, Marlin | X / Y | 80 / 80 | 16 / 16 | 6000 | 500 | 25 mm | mm |
| LinuxCNC mill | X / Y | 200 / 200 | 8 / 8 | 2400 | 300 | 20 mm | mm |

Section default for uploaded files: 8 s before the melody, 60 s long, with a visible notice and a button to use the whole song. Book songs open at full length. Fill gap 0.6 s. Bass notes shorter than 0.12 s merge into the note before.

REVTURN C-axis (opt-in third voice): $103 13.333 steps/deg, 8x micro, $113 99000 deg/min, $123 3000 deg/s².

## Change log

- 2026-11-12: first version. The arranger moved here from the REVTURN tools (`gen-gp-song.mjs` now imports it);
  the REVTURN lathe preset writes byte-identical programs to the old tool (checked on 60 song cases).
  Tested on the lathe: Somebody Told Me (made in the page, private), Für Elise (shipped g-code, video in docs/media).
- 2026-11-12: added Beethoven Symphony No. 5 (opening) and the Turkish March (in E, grace notes as slides; melody notes read from a MIDI in Rev's collection, arrangement by JMSCNC). Slides play in the REVTURN screen's song book; SONGCODE's g-code at that date played the plain notes.
- 2026-11-14 (0.4.0, branch `cos/next-steps`, local commit only): LISTEN uses a grbl/grblHAL-style planner (trapezoid accel/decel, junction-deviation cornering, lookahead, per-axis max rate/accel) so the preview's timing and pitch match the machine; notes the planner cannot bring up to the written feed are warned. MIDI SMPTE time division (including 29.97 drop-frame) is converted correctly. Non-channel-10 drum parts (GS/XG bank, named kits, Guitar Pro percussion) are detected, with a DRUMS toggle and a GM/GS/XG drum-map on the parts table. Default two-axis output is unchanged. Issue drafts 004–005 marked done, not filed.
- 2026-11-14 (0.3.0, branch `cos/next-steps`, not published): Guitar Pro slide / legato-slide / bend effects and MIDI pitch-bend / portamento import onto the same `~` feed-rate ramp. In-app 2D/3D bounce-box path plot with overtravel warnings, plus a travel summary in the downloaded file only. Opt-in rotary feed math (G93 inverse time, deg/min, or path-with-radius) for an A/B/C voice on grbl / Marlin / LinuxCNC presets. Default two-axis output for book songs without slides is unchanged. Issue drafts 001–003 marked done; 004–005 still open, not filed.
- 2026-11-14 (0.2.0, branch `cos/next-steps`, not published): `~` slides are written as a feed-rate ramp in the g-code; book songs load from the arrangements so the flags survive. REVTURN gains two opt-in voices (C-axis trio, drums on Z) that stay off by default, so two-axis output for songs without slides is unchanged. Uploaded files show a notice when only a 60 s window is converted. LISTEN follows each motor's accel ramp. The old `drone` path that emitted M3 is ignored. vitest is 5.1.0 (0 audit findings). Remaining limitations are drafted in `docs/issues/`, not filed.

