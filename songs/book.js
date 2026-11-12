// SPDX-License-Identifier: GPL-3.0-or-later
// SONGCODE by JMSCNC, Copyright (C) 2026 Rev. J. Money / JMSCNC (jmscnc.com).
// Licensed GPL-3.0-or-later; keep this attribution (GPLv3 section 7(b), see NOTICE.md).
//
// The SONGCODE song book: public-domain melodies arranged by JMSCNC for two stepper motors (melody + bass), written
// from the old public-domain tunes, not copied from anyone's file. tools/make-songs.mjs turns these into the MIDI
// (songs/midi) and Guitar Pro (songs/tabs) files shipped in this repo. Same notation as the REVTURN lathe song book:
//   NOTE:units (C4 = middle C, # = sharp), r:units = rest, a trailing ~ = slide into the next note, | = bar line.
// unit = seconds per unit; spu = 16th notes per unit; ts = time signature; pickup = units before the first full bar;
// tempo = [[unit position, speed factor], ...] for speed-ups. drone = the REVTURN chuck note (ignored here).

export const BOOK = [
  {
    id: 'gymnopedie', spu: 4, ts: [3, 4], pickup: 1,
    title: 'Gymnopédie No. 1',
    composer: 'Erik Satie, 1888',
    drone: 'D5', // in both chords it rocks between (G and D)
    unit: 0.6, // one quarter note; "lent et douloureux"
    note: 'Slow and dreamy: long notes are what steppers do best. Melody an octave down (the score tops out above X max).',
    x: `r:13 | F#4:1 A4:1 G4:1 F#4:1 C#4:1 B3:1 C#4:1 D4:1~ A3:3 F#3:12 r:1
        F#4:1 A4:1 G4:1 F#4:1 C#4:1 B3:1 C#4:1 D4:1~ A3:3 C#4:3 F#4:3 E3:9
        A3:1 B3:1 C4:1 E4:1 D4:1 B3:1 D4:1 C4:1 B3:1 D4:3 r:2 D4:1 E4:1 F4:1 G4:1 A4:1 C4:1 D4:1 E4:1 D4:1 B3:1
        D4:3 D4:2 D4:1 G4:3 F#4:3 B3:1 A3:1 B3:1 C#4:1 D4:1 E4:1 C#4:1 D4:1 E4:1~ F#3:9`,
    z: `G2:3 D2:3 G2:3 D2:3 G2:3 D2:3 G2:3 D2:3 G2:3 D2:3 G2:3 D2:3 G2:3 D2:3 G2:3 D2:3
        F#2:3 B2:3 A2:6 D2:3 A2:3 D2:12 D2:6 D2:6 D2:3 E2:3 F#2:3 B2:3 E2:9 A2:3 D2:12`,
  },
  {
    id: 'fur-elise', spu: 1, ts: [3, 8], pickup: 2,
    title: 'Für Elise',
    composer: 'Ludwig van Beethoven, 1810',
    drone: 'A5',
    unit: 0.18, // one 16th note
    note: 'The A section twice, the middle bit, and A again.',
    x: `E5:1 D#5:1 | E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 | A4:2 r:1 C4:1 E4:1 A4:1 | B4:2 r:1 E4:1 G#4:1 B4:1 | C5:2 r:1 E4:1 E5:1 D#5:1
        | E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 | A4:2 r:1 C4:1 E4:1 A4:1 | B4:2 r:1 E4:1 C5:1 B4:1 | A4:2 r:2 E5:1 D#5:1
        | E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 | A4:2 r:1 C4:1 E4:1 A4:1 | B4:2 r:1 E4:1 G#4:1 B4:1 | C5:2 r:1 E4:1 E5:1 D#5:1
        | E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 | A4:2 r:1 C4:1 E4:1 A4:1 | B4:2 r:1 E4:1 C5:1 B4:1 | A4:2 r:1 B4:1 C5:1 D5:1
        | E5:3 G4:1 F5:1 E5:1 | D5:3 F4:1 E5:1 D5:1 | C5:3 E4:1 D5:1 C5:1 | B4:2 r:1 E4:1 E5:1 D#5:1
        | E5:1 D#5:1 E5:1 D#5:1 E5:1 D#5:1 | E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 | A4:2 r:1 C4:1 E4:1 A4:1 | B4:2 r:1 E4:1 G#4:1 B4:1
        | C5:2 r:1 E4:1 E5:1 D#5:1 | E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 | A4:2 r:1 C4:1 E4:1 A4:1 | B4:2 r:1 E4:1 C5:1 B4:1 | A4:6`,
    z: `r:2 | r:6 | A2:6 | E2:6 | A2:6 | r:6 | A2:6 | E2:6 | A2:6
        | r:6 | A2:6 | E2:6 | A2:6 | r:6 | A2:6 | E2:6 | A2:6
        | C3:6 | G2:6 | A2:6 | E2:6 | r:6 | r:6 | A2:6 | E2:6 | A2:6 | r:6 | A2:6 | E2:6 | A2:6`,
  },
  {
    id: 'mountain-king', spu: 2, ts: [4, 4],
    title: 'In the Hall of the Mountain King',
    composer: 'Edvard Grieg, 1875',
    drone: 'B4',
    unit: 0.3, // one 8th note at the start; every time round it gets faster
    note: 'Six times round, faster every time, then a slide down to the end. Z doubles the tune two octaves down.',
    tempo: [[0, 1], [32, 1.18], [64, 1.4], [96, 1.66], [128, 1.98], [160, 2.35]],
    x: `B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:2 | F4:1 C#4:1 F4:2 E4:1 C4:1 E4:2 | B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 B4:1 | A4:1 F#4:1 D4:1 F#4:1 A4:4
        B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:2 | F4:1 C#4:1 F4:2 E4:1 C4:1 E4:2 | B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 B4:1 | A4:1 F#4:1 D4:1 F#4:1 A4:4
        B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:2 | F4:1 C#4:1 F4:2 E4:1 C4:1 E4:2 | B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 B4:1 | A4:1 F#4:1 D4:1 F#4:1 A4:4
        B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:2 | F4:1 C#4:1 F4:2 E4:1 C4:1 E4:2 | B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 B4:1 | A4:1 F#4:1 D4:1 F#4:1 A4:4
        B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:2 | F4:1 C#4:1 F4:2 E4:1 C4:1 E4:2 | B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 B4:1 | A4:1 F#4:1 D4:1 F#4:1 A4:4
        B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:2 | F4:1 C#4:1 F4:2 E4:1 C4:1 E4:2 | B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 B4:1 | A4:1 F#4:1 D4:1 F#4:1 A4:4
        B4:2 r:1 B4:3~ B3:6`,
    z: `B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:2 | F2:1 C#2:1 F2:2 E2:1 C2:1 E2:2 | B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:1 B2:1 | A2:1 F#2:1 D2:1 F#2:1 A2:4
        B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:2 | F2:1 C#2:1 F2:2 E2:1 C2:1 E2:2 | B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:1 B2:1 | A2:1 F#2:1 D2:1 F#2:1 A2:4
        B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:2 | F2:1 C#2:1 F2:2 E2:1 C2:1 E2:2 | B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:1 B2:1 | A2:1 F#2:1 D2:1 F#2:1 A2:4
        B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:2 | F2:1 C#2:1 F2:2 E2:1 C2:1 E2:2 | B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:1 B2:1 | A2:1 F#2:1 D2:1 F#2:1 A2:4
        B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:2 | F2:1 C#2:1 F2:2 E2:1 C2:1 E2:2 | B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:1 B2:1 | A2:1 F#2:1 D2:1 F#2:1 A2:4
        B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:2 | F2:1 C#2:1 F2:2 E2:1 C2:1 E2:2 | B1:1 C#2:1 D2:1 E2:1 F#2:1 D2:1 F#2:1 B2:1 | A2:1 F#2:1 D2:1 F#2:1 A2:4
        B1:3 r:3 B1:6`,
  },
  {
    id: 'moonlight', spu: 2, ts: [12, 8],
    title: 'Moonlight Sonata (1st movement)',
    composer: 'Ludwig van Beethoven, 1801',
    drone: 'C#5',
    unit: 0.36, // one triplet 8th
    note: 'The rolling triplets on X with the melody stepping in on top, deep octaves on Z (an octave up so Z can sound them).',
    x: `G#3:1 C#4:1 E4:1 G#3:1 C#4:1 E4:1 G#3:1 C#4:1 E4:1 G#3:1 C#4:1 E4:1 | G#3:1 C#4:1 E4:1 G#3:1 C#4:1 E4:1 G#3:1 C#4:1 E4:1 G#3:1 C#4:1 E4:1
        | A3:1 C#4:1 E4:1 A3:1 C#4:1 E4:1 A3:1 D4:1 F#4:1 A3:1 D4:1 F#4:1 | G#3:1 C4:1 F#4:1 G#3:1 C#4:1 E4:1 G#3:1 C#4:1 D#4:1 F#3:1 C4:1 D#4:1
        | G#3:1 C#4:1 E4:1 G#3:1 C#4:1 E4:1 G#3:1 C#4:1 E4:1 G#4:2 G#4:1 | G#4:5 G#4:1 G#4:5 G#4:1
        | A4:6 G#4:6 | F#4:3 B4:3 E4:3~ G#3:1 B3:1 E4:1 | G#3:1 B3:1 E4:1 G#3:1 B3:1 E4:1 G3:1 B3:1 E4:1 G4:2 E4:1 | G4:5 G4:1 G4:5 G4:1 | C#4:12`,
    z: `C#3:12 | B2:12 | A2:6 F#2:6 | G#2:6 G#2:6 | C#3:12 | C3:12 | C#3:6 F#2:6 | B2:6 B2:6 | E3:12 | E3:12 | C#3:12`,
  },
  {
    id: 'ode-to-joy', spu: 2, ts: [4, 4],
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven, 1824 (Symphony No. 9)',
    unit: 0.25,
    note: 'The famous tune, twice round with the middle part.',
    x: `E4:2 E4:2 F4:2 G4:2 | G4:2 F4:2 E4:2 D4:2 | C4:2 C4:2 D4:2 E4:2 | E4:3 D4:1 D4:4
        | E4:2 E4:2 F4:2 G4:2 | G4:2 F4:2 E4:2 D4:2 | C4:2 C4:2 D4:2 E4:2 | D4:3 C4:1 C4:4
        | D4:2 D4:2 E4:2 C4:2 | D4:2 E4:1 F4:1 E4:2 C4:2 | D4:2 E4:1 F4:1 E4:2 D4:2 | C4:2 D4:2 G3:4
        | E4:2 E4:2 F4:2 G4:2 | G4:2 F4:2 E4:2 D4:2 | C4:2 C4:2 D4:2 E4:2 | D4:3 C4:1 C4:4`,
    z: `C3:8 | G2:8 | C3:8 | G2:8 | C3:8 | G2:8 | C3:4 G2:4 | C3:8
        | G2:8 | G2:4 C3:4 | G2:4 C3:4 | C3:4 G2:4 | C3:8 | G2:8 | C3:4 G2:4 | G2:4 C3:4`,
  },
  {
    id: 'twinkle', spu: 4, ts: [4, 4],
    title: 'Twinkle, Twinkle, Little Star',
    composer: 'Traditional (French melody, 1761)',
    unit: 0.42,
    note: 'Every motor\'s first song.',
    x: `C4:1 C4:1 G4:1 G4:1 | A4:1 A4:1 G4:2 | F4:1 F4:1 E4:1 E4:1 | D4:1 D4:1 C4:2
        | G4:1 G4:1 F4:1 F4:1 | E4:1 E4:1 D4:2 | G4:1 G4:1 F4:1 F4:1 | E4:1 E4:1 D4:2
        | C4:1 C4:1 G4:1 G4:1 | A4:1 A4:1 G4:2 | F4:1 F4:1 E4:1 E4:1 | D4:1 D4:1 C4:2`,
    z: `C3:4 | F2:2 C3:2 | F2:2 C3:2 | G2:2 C3:2 | C3:2 F2:2 | C3:2 G2:2 | C3:2 F2:2 | C3:2 G2:2
        | C3:4 | F2:2 C3:2 | F2:2 C3:2 | G2:2 C3:2`,
  },
  {
    id: 'amazing-grace', spu: 2, ts: [3, 4], pickup: 2,
    title: 'Amazing Grace',
    composer: 'Traditional (tune "New Britain", 1829)',
    unit: 0.3,
    note: 'Slow and singing: long notes suit steppers.',
    x: `D4:2 | G4:4 B4:1 G4:1 | B4:4 A4:2 | G4:4 E4:2 | D4:4 D4:2 | G4:4 B4:1 G4:1 | B4:4 A4:2 | D5:6
        | D5:4 B4:2 | D5:4 B4:1 G4:1 | B4:4 A4:2 | G4:4 E4:2 | D4:4 D4:2 | G4:4 B4:1 G4:1 | B4:4 A4:2 | G4:6`,
    z: `r:2 | G2:6 | G2:6 | C3:6 | G2:6 | G2:6 | D3:6 | D3:6 | G2:6 | G2:6 | G2:6 | C3:6 | G2:6 | G2:6 | D3:6 | G2:6`,
  },
  {
    id: 'greensleeves', spu: 2, ts: [3, 4], pickup: 2,
    title: 'Greensleeves',
    composer: 'Traditional (England, 16th century)',
    unit: 0.27,
    note: 'The first verse in A minor.',
    x: `A4:2 | C5:4 D5:2 | E5:3 F5:1 E5:2 | D5:4 B4:2 | G4:3 A4:1 B4:2 | C5:4 A4:2 | A4:3 G#4:1 A4:2 | B4:4 G#4:2 | E4:4 A4:2
        | C5:4 D5:2 | E5:3 F5:1 E5:2 | D5:4 B4:2 | G4:3 A4:1 B4:2 | C5:3 B4:1 A4:2 | G#4:3 F#4:1 G#4:2 | A4:6 | A4:6`,
    z: `r:2 | A2:6 | C3:6 | G2:6 | E2:6 | A2:6 | F2:6 | E2:6 | E2:6 | A2:6 | C3:6 | G2:6 | E2:6 | A2:3 F2:3 | E2:6 | A2:6 | A2:6`,
  },
  {
    id: 'saints', spu: 2, ts: [4, 4],
    title: 'When the Saints Go Marching In',
    composer: 'Traditional (American spiritual)',
    unit: 0.22,
    note: 'A marching tune with a walking root bass.',
    x: `r:2 C4:2 E4:2 F4:2 | G4:8 | r:2 C4:2 E4:2 F4:2 | G4:8 | r:2 C4:2 E4:2 F4:2 | G4:4 E4:4 | C4:4 E4:4 | D4:8
        | r:4 E4:2 D4:2 | C4:6 C4:2 | E4:4 G4:4 | G4:2 F4:6 | r:2 E4:2 F4:2 G4:2 | E4:4 C4:4 | D4:4 D4:4 | C4:8`,
    z: `C3:8 | C3:4 G2:4 | C3:8 | C3:4 G2:4 | C3:8 | C3:8 | C3:8 | G2:8
        | G2:8 | C3:8 | C3:8 | F2:8 | F2:8 | C3:8 | G2:8 | C3:8`,
  },
  {
    id: 'scarborough-fair', spu: 4, ts: [3, 4],
    title: 'Scarborough Fair',
    composer: 'Traditional (English ballad)',
    unit: 0.5,
    note: 'The old ballad in D dorian.',
    x: `D4:2 D4:1 | A4:2 A4:1 | E4:1 F4:1 E4:1 | D4:3 | r:1 A4:1 C5:1 | D5:2 C5:1 | A4:1 B4:1 G4:1 | A4:3
        | r:1 D5:1 D5:1 | D5:2 C5:1 | A4:2 A4:1 | G4:1 F4:1 E4:1 | C4:3 | D4:2 A4:1 | G4:2 F4:1 | E4:1 D4:1 C4:1 | D4:3`,
    z: `D3:3 | D3:3 | A2:3 | D3:3 | D3:3 | D3:3 | G2:3 | A2:3
        | D3:3 | D3:3 | F2:3 | C3:3 | C3:3 | D3:3 | G2:3 | C3:3 | D3:3`,
  },
  {
    id: 'canon-in-d', spu: 4, ts: [4, 4],
    title: 'Canon in D',
    composer: 'Johann Pachelbel, about 1690',
    unit: 0.55,
    note: 'The ground bass on Z the whole way, the canon tune on X.',
    x: `F#4:2 E4:2 | D4:2 C#4:2 | B3:2 A3:2 | B3:2 C#4:2 | D4:2 C#4:2 | B3:2 A3:2 | G3:2 F#3:2 | G3:2 E3:2
        | D3:1 F#3:1 A3:1 G3:1 | F#3:1 D3:1 F#3:1 E3:1 | D3:1 B2:1 D3:1 A3:1 | G3:1 B3:1 A3:1 G3:1
        | F#3:1 D3:1 E3:1 C#4:1 | D4:1 F#4:1 A4:1 A3:1 | B3:1 G3:1 A3:1 F#3:1 | D3:1 D4:1 D4:2`,
    z: `D3:2 A2:2 | B2:2 F#2:2 | G2:2 D2:2 | G2:2 A2:2 | D3:2 A2:2 | B2:2 F#2:2 | G2:2 D2:2 | G2:2 A2:2
        | D3:2 A2:2 | B2:2 F#2:2 | G2:2 D2:2 | G2:2 A2:2 | D3:2 A2:2 | B2:2 F#2:2 | G2:2 D2:2 | G2:2 A2:2`,
  },
  {
    id: 'beethoven-5', spu: 2, ts: [2, 4],
    title: 'Symphony No. 5 (opening)',
    composer: 'Ludwig van Beethoven, 1808',
    drone: 'C5',
    unit: 0.15, // one 8th note; the second time round is faster
    note: 'Da-da-da-DUM with every long note sliding down, the bass doubling it low on Z (under 4 ipm, below the rough Z band).',
    tempo: [[0, 1], [112, 1.2]],
    x: `r:1 G5:1 G5:1 G5:1 | D#5:4~ | C5:4 | r:1 F5:1 F5:1 F5:1 | D5:4~ | B4:4 |
        r:1 G5:1 G5:1 G5:1 | G#5:1 G#5:1 G#5:1 G5:1~ | D#5:1 D#5:1 D#5:1 D5:1~ | C5:1 C5:1 C5:1 B4:1~ | G4:2~ G5:2~ | G4:2~ G5:2 |
        r:1 G5:1 G5:1 G5:1 | D#5:1 G#5:1 G#5:1 G#5:1 | G5:1 D#5:1 D#5:1 D#5:1 | D5:1 F5:1 F5:1 F5:1 | D#5:1 C5:1 C5:1 C5:1 | B4:1 D5:1 D5:1 D5:1 |
        C5:4~ | G5:4~ | D#5:4~ | C5:4~ | G4:4 | r:1 G5:1 G5:1 G5:1 | D#5:4~ | C5:4~ | C4:8 |
        r:1 G5:1 G5:1 G5:1 | D#5:4~ | C5:4 | r:1 F5:1 F5:1 F5:1 | D5:4~ | B4:4 |
        r:1 G5:1 G5:1 G5:1 | G#5:1 G#5:1 G#5:1 G5:1~ | D#5:1 D#5:1 D#5:1 D5:1~ | C5:1 C5:1 C5:1 B4:1~ | G4:2~ G5:2~ | G4:2~ G5:2 |
        r:1 G5:1 G5:1 G5:1 | D#5:1 G#5:1 G#5:1 G#5:1 | G5:1 D#5:1 D#5:1 D#5:1 | D5:1 F5:1 F5:1 F5:1 | D#5:1 C5:1 C5:1 C5:1 | B4:1 D5:1 D5:1 D5:1 |
        C5:4~ | G5:4~ | D#5:4~ | C5:4~ | G4:4 | r:1 G5:1 G5:1 G5:1 | D#5:4~ | C5:4~ | C4:8`,
    z: `r:1 G2:1 G2:1 G2:1 | D#2:4~ | C2:4 | r:1 F2:1 F2:1 F2:1 | D2:4~ | B1:4 |
        r:1 C2:1 C2:1 C2:1 | G#1:4 | G2:4 | C2:4 | G2:2~ G#1:2~ | G2:2~ C2:2 |
        r:1 G2:1 G2:1 G2:1 | C2:4 | D#2:4 | G2:4 | C2:4 | G2:4 |
        C2:4~ | G2:4~ | D#2:4~ | C2:4~ | G2:4 | r:1 G2:1 G2:1 G2:1 | D#2:4~ | D2:4~ | C2:8 |
        r:1 G2:1 G2:1 G2:1 | D#2:4~ | C2:4 | r:1 F2:1 F2:1 F2:1 | D2:4~ | B1:4 |
        r:1 C2:1 C2:1 C2:1 | G#1:4 | G2:4 | C2:4 | G2:2~ G#1:2~ | G2:2~ C2:2 |
        r:1 G2:1 G2:1 G2:1 | C2:4 | D#2:4 | G2:4 | C2:4 | G2:4 |
        C2:4~ | G2:4~ | D#2:4~ | C2:4~ | G2:4 | r:1 G2:1 G2:1 G2:1 | D#2:4~ | D2:4~ | C2:8`,
  },
  {
    id: 'turkish-march', spu: 1, ts: [2, 4],
    title: 'Turkish March (The Ruins of Athens)',
    composer: 'Ludwig van Beethoven, 1811',
    drone: 'E5',
    unit: 0.12, // one 16th note; second half faster
    note: 'In E so the high notes sit on the smoothest X top notes (F#5-G#5); every grace note is a slide. Bass on Z under 4 ipm.',
    tempo: [[0, 1], [256, 1.15]],
    x: `A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 E4:1~ G#4:2 r:1 | A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 G#5:3 r:1 | F#5:2~ C#5:2~ D#5:2~ C#5:2 | B4:3 r:1 A4:3 r:1 | G#4:3 r:1 A4:3 r:1 | B4:6 r:2 |
        A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 E4:1~ G#4:2 r:1 | A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 G#5:3 r:1 | F#5:2~ C#5:2~ D#5:2~ C#5:2 | B4:3 r:1 C5:3 r:1 | C#5:8 | C#5:7~ D#5:1~ |
        E5:4 C#5:3 r:1 | C#5:3 r:1 C#5:3 r:1 | D#5:1~ E5:1~ F#5:2 D#5:3 r:1 | D#5:3 r:1 D#5:3 r:1 | D#5:1~ E5:1~ F#5:2 D#5:3 r:1 | D#5:1~ E5:1~ F#5:4 r:2 | E5:1~ F#5:1~ G#5:3 r:1 E5:2 | E5:1~ F#5:1~ G#5:3 r:1 E5:2 |
        A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 E4:1~ G#4:2 r:1 | A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 G#5:3 r:1 | F#5:2~ C#5:2~ D#5:2~ C#5:2 | B4:3 r:1 A4:3 r:1 | G#4:3 r:1 A4:3 r:1 | B4:6 r:2 |
        A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 E4:1~ G#4:2 r:1 | A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 G#5:3 r:1 | F#5:2~ C#5:2~ D#5:2~ C#5:2 | B4:3 r:1 A4:3 r:1 | G#4:3 r:1 A4:3 r:1 | B4:6 r:2 |
        A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 E4:1~ G#4:2 r:1 | A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 G#5:3 r:1 | F#5:2~ C#5:2~ D#5:2~ C#5:2 | B4:3 r:1 C5:3 r:1 | C#5:8 | C#5:7~ D#5:1~ |
        E5:4 C#5:3 r:1 | C#5:3 r:1 C#5:3 r:1 | D#5:1~ E5:1~ F#5:2 D#5:3 r:1 | D#5:3 r:1 D#5:3 r:1 | D#5:1~ E5:1~ F#5:2 D#5:3 r:1 | D#5:1~ E5:1~ F#5:4 r:2 | E5:1~ F#5:1~ G#5:3 r:1 E5:2 | E5:1~ F#5:1~ G#5:3 r:1 E5:2 |
        A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 E4:1~ G#4:2 r:1 | A#4:1~ B4:3 G#4:3 r:1 | E4:1~ G#4:2 r:1 G#5:3 r:1 | F#5:2~ C#5:2~ D#5:2~ C#5:2 | B4:3 r:1 A4:3 r:1 | G#4:3 r:1 A4:3 r:1 | B4:6 r:2 |
        E4:1~ G#4:1~ B4:1~ E5:5`,
    z: `E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4 B1:4 | B1:3 r:1 B1:3 r:1 | E2:4 B1:4 | B1:7~ E2:1 |
        E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4 B1:4 | B1:4~ G#1:4~ | C#2:8 | G#1:7~ C#2:1 |
        C#2:8 | G#1:4 C#2:4 | B1:8 | D#2:4 B1:4 | B1:8 | B1:6~ E2:2 | E2:8 | E2:6~ B1:2 |
        E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4 B1:4 | B1:3 r:1 B1:3 r:1 | E2:4 B1:4 | B1:7~ E2:1 |
        E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4 B1:4 | B1:3 r:1 B1:3 r:1 | E2:4 B1:4 | B1:7~ E2:1 |
        E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4 B1:4 | B1:4~ G#1:4~ | C#2:8 | G#1:7~ C#2:1 |
        C#2:8 | G#1:4 C#2:4 | B1:8 | D#2:4 B1:4 | B1:8 | B1:6~ E2:2 | E2:8 | E2:6~ B1:2 |
        E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4~ B1:2 r:2 | B1:2 r:2 B1:2 r:2 | E2:4 B1:4 | B1:3 r:1 B1:3 r:1 | E2:4 B1:4 | B1:7~ E2:1 |
        E2:8`,
  },
];
