# DONE in 0.3.0 (local `cos/next-steps`, 2026-11-14) — Guitar Pro and MIDI slide import

This draft was implemented on the local branch. It was **not** filed on GitHub.

---

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


## Resolution (0.3.0)

`fromGuitarPro` walks the score (ties merged), strips slide/bend effects so the MIDI generator keeps every destination note, and overlays `slide` / `slideTo` on the parsed notes. `parseMidi` turns pitch-bend (RPN 0,0) and portamento (CC 65) into the same flags. `bookMidi` writes a ±24-semitone RPN and a bend ramp for `~` notes. Shipped `.mid` / `.gp` files for slide songs were regenerated; songs without slides are unchanged.
