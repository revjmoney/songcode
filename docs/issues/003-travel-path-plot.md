# No plot of the bounce-box path before cycle start

**Type:** enhancement
**Area:** `src/app/main.js` plot, result panel

## What's going on

The result panel shows peak travel (`±X`, `±Z`) and a piano-roll of the notes, plus a return-to-start move. It does not draw the actual tool path inside the travel box: the back-and-forth reversals, where a long slide bounces, or how start/end code sits relative to the box.

For a shop check, a simple 2-axis path plot (start point at the centre, box outline, the polyline of G1 moves, and the final return) would catch a surprising bounce or a diameter-mode X surprise before anyone hits cycle start.

## Suggested work

A second canvas under the notes plot, in the program's units, with the travel box and the G1 polyline. Optional: animate it in time with LISTEN.

## Not in scope

A full backplot with tool, stock, or 3-D. This is only a bounce-box sketch.
