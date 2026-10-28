# Avatar explainer mode

Loaded only when the source is an avatar video (HeyGen or similar) and the job is a data or concept explainer.
Distilled from a HeyGen editing SOP, "Editing and polishing a HeyGen video with nothing but the video itself" (v0.3,
2026-10-19). Its numbers are from one 2-minute video and one Whisper model (small); treat them as a
warning, not a law.

## Contents
1. When the mode applies
2. Captions as the timing source
3. Number-and-source table (the gate)
4. Content to shot table
5. Pacing rules
6. Free-stock B-roll and LICENSES.md
7. Report-to-client line
8. What was left out on purpose

## 1. When the mode applies
All of: the presenter is an avatar or a fixed-background synthetic video; the operator has the script or a caption file from the
generator; the output is meant to explain something with figures, comparisons or places. A human raw take, a reel with
no data, or anything for `storytelling-reel-editor` stays on the normal workflow. Pacing and shot rules below never
apply outside this mode.

## 2. Captions as the timing source
The SOP's test: Whisper small against HeyGen's own captions, 27 sentence boundaries, start error median about 0.47 s,
90th percentile 1.5 to 1.7 s, only a third within 0.3 s. Not good enough for subtitles. `large-v3` and forced aligners
were not tested.
- Use the generator's SRT for caption timing. Skip transcription for captions.
- Clean it before use: fix pronunciation hacks (a homophone typed so the avatar says a word right, for example
  "而零二五" for "二零二五"), re-join split acronyms and numbers, drop leading punctuation, keep the text identical to the voice.
  Where the spoken number differs from the written one, the voice is the reference.
- If a shot must land on one word inside a caption line, take that word's time from `large-v3` and check it by ear and by
  frame. Say in the output which timing came from which source.
- No SRT and only the script: Whisper timing locates speech to about +/-1.5 s. Do not burn it as subtitles; ask the operator
  for the generator's captions.
- No script and no SRT: transcribe, then proofread every number and proper noun. The SOP found at least seven key errors in
  two minutes (OECD became a different word, "about 133bn pounds" became "1331 pounds"). Unproofed numbers never go on screen.

## 3. Number-and-source table (the gate)
Written to `assets/number-sources.md` before any composition HTML. One row per figure, percentage or date that will
appear on screen:

| On-screen text | Spoken phrase and time | Source | Status | Clearance |
|---|---|---|---|---|
| "5.2%" | "百分之五点二" at 00:41 | named table, filing or URL | verified / calculated / estimated / forecast | `-` or where the clearance is recorded |

Rules:
- No source: the number comes off the screen or becomes words. Never invent or round to fit.
- `calculated`, `estimated` and `forecast` carry a visible tag on screen stating the basis.
- A client name, figure or result needs a Clearance cell pointing to where the operator records it as cleared
  (a client file, an email, a signed release). Empty cell, not on screen.
- Use the currency the brief names; when the brief names none, ask. Write the currency on screen.
- Check what a figure measures before quoting it (a count of what, over which period). Put that definition in the Source cell.
- The table is a delivery file. QA checks every on-screen number against it.

## 4. Content to shot table
| What the speech contains | Shot |
|---|---|
| Opening, closing | Full-frame presenter, name card only if the brief asks |
| Place, institution, scene | Small presenter inset over relevant B-roll, or a graphic card when no reliable footage exists |
| One key number | Large count-up number plus a source line |
| A ratio or share | Dial, or a bar against a 100% reference line |
| Two things compared | Split screen or twin bars |
| Years, a sequence, "from... to..." | Timeline, forecast points dashed |
| A question | Large question mark |
| First, second, third | Cards that appear one by one |
| One emphasised word | Large keyword over a blurred background |
| Negation or correction | Strike-through on the wrong word |
| Scale comparison | Scale bars |
| Closing question | Option cards, 2 to 3 |

Data and keyword shots never sit on a flat empty colour: use a blurred still or the blurred source video. Check a frame
before choosing a clip (in the SOP, a housing shot showed a cafe after a centre crop).

## 5. Pacing rules
- Group sentences into segments of at most 5 s; each has a visible change or animated element.
- The same shot type does not run twice in a row.
- Kickers about ten characters or fewer; long labels move below the line, not under an inset.
- Parallel items are never auto-wrapped: insert manual line breaks, never mid-word.
- Subtitle lines never break inside a number, an acronym or a fixed phrase. Check the SRT after cleaning.
- An inset presenter plays the source at the current moment. If it drifts, the sub-window's video start is missing its offset.
- Judge pacing from frame strips plus the operator's view; Claude cannot watch playback.

## 6. Free-stock B-roll and LICENSES.md
Sits after real footage and screen recordings in the B-roll order. Before downloading, list each candidate with source,
ID, licence and expected size, give a total cap, and wait for the operator's yes. Then record each file in `assets/LICENSES.md`:
file, source, ID, licence and terms, date. A file with no row is removed from the project. Vertical clips as they are;
horizontal clips cropped and checked on a frame. Where no reliable footage exists (a specific building, archive material),
use a graphic card. Public-person cards need a licensed photo and a verified name; otherwise skip them.

## 7. Report-to-client line
If an on-screen claim is narrower than the spoken sentence (the voice says more than the evidence supports), list it under
"Could not verify" in the output and let the operator or the client decide whether to re-record. Do not change the spoken words.

## 8. What was left out on purpose
Cut-out presenter with a white outline on ProRes 4444 alpha, and the small-head circle styling, are kept as later options.
CJK type and line length, WeChat Channels rules, the SOP's own palette, loudness target and safe-area numbers (marked
unverified there) are not adopted. The brand profile, this skill's loudness check on the encoded stereo file and the
profile's safe zones stay in force.
