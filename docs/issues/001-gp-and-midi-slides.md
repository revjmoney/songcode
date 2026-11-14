# Book-style `~` slides are not recovered from dropped MIDI or Guitar Pro files

**Type:** enhancement
**Area:** `src/music/load.js`, `src/music/midi.js`

## What works now

The song book marks slides with a trailing `~` (Turkish March, Symphony No. 5, Mountain King, Gymnopédie, Moonlight).
SONGCODE expands those into a feed-rate ramp in the g-code, and the page loads book songs from the arrangements so the flags survive.

## What's still missing

- The shipped `.mid` files and the MIDI writer have no slide or pitch-bend data, so a book MIDI opened as an upload is still flat notes.
- Uploaded Guitar Pro files go through alphaTab's MIDI generator. Slide-in / slide-out / legato marks on the tab are not copied onto the note list. Pitch-bend events are not parsed.
- A user who drops their own tab with slides will not hear or see those bends until this is wired.

## Suggested work

1. When reading Guitar Pro, walk alphaTab's score notes and set `slide: true` where the tab has a slide into the next note.
2. Optionally parse MIDI pitch-bend and turn a bend into a short ramp, or store `~` in a SMF text/meta event in `bookMidi` so the shipped MIDIs round-trip.

## Not in scope

Changing how the book itself is notated.
