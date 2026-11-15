# Non-GM drum channels and SMPTE-timed MIDI

**Type:** caveat
**Area:** `src/music/midi.js`, `src/music/load.js`

## What's going on

- General MIDI drums (channel 10, 0-based 9) and Guitar Pro percussion staves are collected into `song.drums` and left out of the default two-axis program. The REVTURN "drums on Z" option can play kicks and snares from that list.
- Drum hits on any other channel are treated as pitched notes and may be auto-picked as melody or bass.
- SMPTE-timed MIDI (`division` with the high bit set) is rejected with "SMPTE-timed MIDI files are not supported". Format 0 and 1 with a PPQ division are fine. Format 2 is not special-cased.

## Suggested work

- A "this track is drums" toggle on the part table, so a non-GM kit can be sent to `song.drums` instead of a pitched voice.
- If someone actually needs SMPTE or format 2, say so and we can add it; it has not come up in the song book.

## Workaround

In a DAW or a MIDI editor, move the kit to channel 10 before dropping the file in, or mute that track.
