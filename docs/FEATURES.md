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
| Free song book: 11 public-domain tunes arranged by JMSCNC, as MIDI, Guitar Pro tab and g-code | done 2026-11-12 |
| One-file build (dist/index.html), GitHub Pages workflow | done 2026-11-12 |

## Settings (preset defaults)

| Preset | Axes | Steps/mm | Micro | Max mm/min | Accel mm/s2 | Travel | Units |
|---|---|---|---|---|---|---|---|
| REVTURN lathe | X / Z | 800 / 1932 | 16 / 32 | 1016 / 558.8 | 50 / 12 | 0.65 / 0.4 in | in, diameter, G7 |
| grbl mill / router | X / Y | 80 / 80 | 16 / 16 | 3000 | 200 | 20 mm | mm |
| 3D printer, Marlin | X / Y | 80 / 80 | 16 / 16 | 6000 | 500 | 25 mm | mm |
| LinuxCNC mill | X / Y | 200 / 200 | 8 / 8 | 2400 | 300 | 20 mm | mm |

Section default: 8 s before the melody, 60 s long. Fill gap 0.6 s. Bass notes shorter than 0.12 s merge into the note before.

## Change log

- 2026-11-12: first version. The arranger moved here from the REVTURN tools (`gen-gp-song.mjs` now imports it);
  the REVTURN lathe preset writes byte-identical programs to the old tool (checked on 60 song cases).
  Tested on the lathe: Somebody Told Me (made in the page, private), Für Elise (shipped g-code, video in docs/media).
