---
name: herk-edit
description: >
  Dresses a talking-head recording or a chosen clip into a finished reel, Short or explainer in the
  operator's own brand with the Herk Edit Kit (HyperFrames): picks or builds a brand profile, silence
  cut, retakes shown for approval, story beat plan, moving B-roll in preference order, HTML
  motion-graphics cards, captions, sound design, draft render, frame-strip and loudness
  verification. Use for "edit this clip", "edit this for Instagram", "add captions and graphics",
  "add B-roll to this clip", "motion graphics for this", "dress this clip", "cut the silences and
  retakes", "make this look polished", "edit this HeyGen video", "set up a brand profile for my
  videos", "edit this in <brand>'s style". Own or licensed footage only. Do NOT use to mine a long
  video for the best moments; cut the clip first, then bring it here. Do NOT use to write hooks or
  scripts. Do NOT use to watch or summarise a video.
metadata:
  version: "2.0.0"
  source: "nateherkai/herk-edit-kit (MIT) via the fork immy1991/herk-edit-kit, which adds brand profiles and fal.ai generation; avatar explainer mode from a HeyGen editing SOP (v0.3, 2026-10-19)"
  status: "shareable edition; brand profile is a setting; kit proved on its synthetic demo; evals SYNTHETIC"
---

# herk-edit

## Purpose
One recording or clip in, a finished video in the chosen brand out, every claim about it backed by a frame or a measurement.

## Settings

| Setting | Where | Default |
|---|---|---|
| Kit location | `HERK_KIT` environment variable | Ask once where the kit is cloned, then suggest `export HERK_KIT=<path>` in the shell profile |
| Brand profiles folder | `HERK_BRANDS` environment variable | `$HERK_KIT/brands` |
| Brand for this video | the brief ("in Acme's style"), else asked | The only profile if exactly one exists |

First time on this machine, or the kit is missing: read `references/setup.md` and walk the operator through it.
Never clone, `npm ci` or add keys without their yes.

## Context Routing Table (read before touching the project)

| Source | Path / Location | What to extract |
|---|---|---|
| The footage and brief | the file the operator gives; what the clip is for, which platform and ratio, target length | Audience, intended action, duration |
| Brand profile | `<brands folder>/<brand>/DESIGN.md`, copied into the project as `DESIGN.md` | Palette, type, captions, hook, sound, music, end card, voice rules, industry rules. Wins over Nate's defaults |
| Nate's measured method | `$HERK_KIT/docs/EDITING-PLAYBOOK.md` | Pacing, layouts, B-roll preference order, sound palette, lessons |
| The kit's skills | `$HERK_KIT/.claude/skills/<name>/SKILL.md` | Only the one for the step you are on (routing table in the kit's `CLAUDE.md`) |
| Cleared facts | wherever the operator records client clearance (the brief, or the path the profile's voice rules name) | A client name, figure or result appears only if it is in the source AND recorded as cleared |
| Avatar explainer mode | `references/avatar-explainer-mode.md` | Only when the source is a HeyGen or other avatar video |
| Prior notes on this skill | `references/learnings.md` | PENDING entries that affect this run |

Priority when sources conflict: the operator's brief → the brand profile → Nate's playbook → the kit's skill defaults.

## Step 0: pick the brand
1. The brief names a brand → use `<brands folder>/<slug>/`. Missing → say so and offer to build it.
2. No brand named → list the folders in the brands folder (ignore `_template`). Exactly one → use it and say which.
   Several → ask which. None → offer to build one.
3. **Building a profile.** Copy `brands/_template/` to `brands/<slug>/` and fill it from the operator's answers, asked
   together in one message: brand name and audience; colours (hex values, or a logo or website to sample from);
   font; caption case, punctuation, size and position; text hook yes or no; music yes or no and how loud; sound
   effects; end card and CTA card; banned words; industry rules (for example: no outcome promises in health or
   finance, required disclaimers). Ask for the logo file; never draw or generate one. Show the filled `DESIGN.md`
   and `tokens.css`, write on a yes.
4. One brand per project. Never carry a profile, logo or footage from one brand into another brand's project.

## Quick Start
1. `cd "$HERK_KIT" && npm run check && npx hyperframes doctor` (Chrome, ffmpeg, whisper-cli must show OK).
2. `npm run new-video -- <slug> --brand <brand>`; copy the source into `video-projects/<slug>/assets/raw.mp4`.
   Check `video-projects/<slug>/meta.json` names the brand and `DESIGN.md` is the brand's.
3. Set the composition size for the platform: 1080x1920 for Reels, Shorts and TikTok; 1920x1080 for YouTube.
4. Follow the Workflow. The kit's own `edit-video` or `short-form-edit` skill carries the detail for each step.

## Workflow

**Mode check first.** Avatar video (HeyGen or similar) plus a script or the generator's captions, and the job is an
explainer with figures: read `references/avatar-explainer-mode.md` and apply its changes to steps 2, 5, 6 and 7 below.
Anything else (a human take, a reel without data) runs the steps as written; the explainer pacing rules never apply to it.
In explainer mode, before step 7, write `assets/number-sources.md` (every on-screen figure: spoken phrase, source, status,
clearance for any client number). No source, no number on screen.

1. **Probe and preserve.** `ffprobe` the source (duration, streams, resolution). Never edit the original.
2. **Transcribe, word-level.** Local whisper.cpp through `npx hyperframes transcribe -e whisper -m large-v3`
   by default (free, offline); ElevenLabs Scribe when speed or accuracy matters and `ELEVENLABS_API_KEY` is set
   in the kit `.env`. Say which one ran and why. Normalise to `{words:[{text,start,end}], audio_duration_secs}`. Reuse an
   existing verified transcript rather than paying twice. (kit: `docs/TOOLS-AND-API-KEYS.md`)
3. **Cut silences first.** `cut-silences` writes the EDL and a retimed transcript. Keep natural beats after a
   comma or "First,"; never a hard zero gap. (kit: `cut-silences`)
4. **Review mistakes, approve each one.** `cut-mistakes` proposes stutters, retakes and false starts with
   context. Read every candidate; emphatic repetition is not a stutter. Write `approved-cuts.json` on the
   silenced timeline, then apply. Never mix raw timestamps with edited footage. (kit: `cut-mistakes`)
5. **Plan the story before visuals.** Hook, proof, items, payoff; one open loop. For a reel, three different
   openings compared on the first 3 seconds. The opening must work muted. (kit: `short-form-edit`, `video-storytelling`)
6. **Source B-roll in order:** real footage of the thing → real screen recording zoomed with a cursor → animated
   UI mock labelled as example → AI video via `motion-showreel/scripts/gen.mjs`: fal.ai by default (`FAL_KEY`), Kie.ai with
   `--provider kie` (`KIE_API_KEY`); `--dry-run` first, state the provider and the number of generations, reuse successful jobs) → highlight crops. Free stock video (explainer mode, or when no
   real footage exists): listed to the operator with source, ID, licence and a size cap, downloaded only after their yes, every
   file recorded in `assets/LICENSES.md`. Video beats
   images every time; an AI still as B-roll is a build error. One scene once per reel; keep the footage ledger.
7. **Build the composition** with the project's `DESIGN.md` and `assets/brand-tokens.css`. Every shot anchored to the
   spoken word it illustrates; captions as body-level siblings; one paused GSAP timeline per composition that fills its
   slot. Keep text and graphics out of the platform zones the profile names. (kit: `hyperframes`, `hyperframes-video-beats`, `MOTION_PHILOSOPHY.md`)
8. **Mix.** Voice normalised; music and sound effects exactly as the profile says. No profile rule → no music, sound
   effects only on visible actions.
9. **Preflight, lint, Studio.** `node scripts/preflight.mjs <project>`, `npx hyperframes lint`,
   `validate-beat-sync.mjs` for anchored beats; for reels also `validate:short-form` and `validate:footage`.
10. **Draft render and inspect.** `npx hyperframes render --quality draft`. Pull frame strips 10 frames each side of
    every cut, the first 2.5 s frame by frame, hero frames at full size and phone size. Listen at every join.
    Re-transcribe the final audio and compare words at every cut. Measure LUFS and true peak on the encoded stereo file.
11. **Fix, re-render, re-check what the fix touched.** Three rounds, then stop and show the operator.
12. **Deliver.** Final MP4 path, `VERIFY.md` with evidence and limits, the proof block below. Keep every render
    under a new name. Ask once: "Any feedback to capture for this skill?"

## Anti-Rationalization

| What Claude might think | Why it's wrong |
|---|---|
| "Lint passed and preflight is green, the video is fine" | Lint proves structure. Only frames and a listen prove a face is not cropped, a word is not clipped, a caption is not over the mouth. Nate's own lesson. |
| "The silence tool said zero retakes, skip the manual read" | A zero-candidate report has missed obvious retakes before. Read the whole transcript. |
| "A zoom on this still counts as B-roll" | It is a photographic layer, not moving footage. The B-roll rule is about motion. |
| "I'll generate a logo close enough to the real one" | Never. Use the exact supplied asset or plain text. |
| "Nate's caption style looks great, use it" | The brand profile wins. Switch only when the operator overrides it for this clip or changes the profile. |
| "Add a music bed, it feels empty" | Music only when the profile says so. Otherwise let the voice and sound effects carry it. |
| "No brand was named, I'll use sensible defaults" | Defaults are nobody's brand. Pick a profile or build one in Step 0. |
| "The last project was for another brand, I'll reuse its cards" | Brands never mix. Rebuild from this brand's profile. |
| "ElevenLabs is set up, use it for everything" | Local whisper is free and the default; ElevenLabs spends credits. Pick per clip and say which ran. |
| "The avatar video came with an SRT, but I'll re-transcribe for word timing" | Whisper small measured about 0.5 s off at sentence boundaries. Use the generator's captions for timing; take single-word times from `large-v3` only where a shot needs one, and check by ear. |
| "That percentage is in the script, so it is sourced" | The script is what was said, not where the figure comes from. Every on-screen number needs a named source and a status, or it is removed. |
| "Explainer pacing (change every 5 s, cards, count-ups) would lift this reel" | Pacing and shot rules are explainer mode only. A reel or talking-head clip keeps the profile's style and the brief. |
| "The stock clip is free, no need to log it" | A file with no `LICENSES.md` row is removed. Source, ID and terms are the only proof it is allowed. |

## Output Format (EXACT)
```
HERK EDIT — <slug> · brand: <brand>
Source: <path> (<duration>, <w>x<h>, <fps>) · transcript: <provider>, <n> words
Cuts: <n> silences trimmed · <n> mistakes proposed, <n> approved (reasons in approved-cuts.json)
Story: hook "<words>" → payoff "<words>" · open loop: <what is planted, where it closes>
B-roll: <n> scenes (<n> real footage, <n> screen recordings, <n> UI mocks, <n> AI video, <n> stock) · ledger: assets/footage-ledger.json · licences: assets/LICENSES.md (or "none used")
Numbers (explainer mode only): <n> on screen · <n> verified · <n> tagged calculated/estimated/forecast · <n> removed for no source · <n> client figures with clearance · table: assets/number-sources.md
Render: renders/<name>-draft.mp4 → renders/<name>-final.mp4 (<duration>, <w>x<h>, <fps>)
Checks: preflight PASS · lint 0/0 · beat-sync PASS · first 2.5 s frame-by-frame OK · frame strips at <n> cuts OK
        final-audio ASR vs raw: <n> word diffs (listed) · <LUFS> integrated · <dBTP> true peak (stereo, encoded file)
Rounds used: <n> of 3
Guessed words: ...
Could not verify: ...
Next: ...
```
A gate not run is written "not run", never "PASS". A loudness number comes from the encoded file, never the mix stage.

## Failure Modes

| Failure | Detect | Recover |
|---|---|---|
| Lip sync drifts by a frame at joins | Cut frames do not match the raw at a join | Select exact frame numbers in one pass; never encode segments separately and concatenate |
| Caption unreadable over bright B-roll | Pixel contrast behind the caption is low | Dark box with a thin light edge, same box for the whole video |
| Clipped word at a cut | Final-audio ASR differs from raw at the boundary, or you hear it | Move the cut to real silence; transcripts end words 40 to 80 ms early |
| Mono loudness reads 3 dB low | Measurement run on a mono stem | Measure the stereo delivery |
| HyperFrames stalls capturing | Render hangs at a phase | Fewer workers, close Chrome-heavy apps; deterministic export plus ffmpeg assembly as fallback |
| No transcription available | whisper model fetch failed and `ELEVENLABS_API_KEY` unset | Stop and ask; never fetch a key from anywhere else |
| `new-video` says no brand profile | Wrong slug, or `HERK_BRANDS` points elsewhere | List the brands folder; build the profile in Step 0 |

## Exit Checklist (run it; report PASS/FAIL with evidence; list what could not be verified)
- [ ] `npm run check` and `npx hyperframes doctor` clean before the first command.
- [ ] `meta.json` names the brand; the project `DESIGN.md` is that brand's profile.
- [ ] Every proposed mistake cut has a recorded decision; none applied unreviewed.
- [ ] Captions, colours, fonts, music, sound effects, end card and CTA card match the profile; no banned word on screen.
- [ ] First 2.5 s read frame by frame; frame strips across every cut; hero frames at phone size; nothing in the platform zones.
- [ ] Final-audio ASR compared with the raw at every cut; LUFS and dBTP measured on the encoded stereo file.
- [ ] No client name, figure or result that is not in the source AND recorded as cleared.
- [ ] Explainer mode only: `assets/number-sources.md` has a row for every on-screen figure, nothing unsourced is on screen, forecast/estimate tags are visible, each client figure has a clearance record, and any claim narrower than the spoken sentence is listed under "Could not verify".
- [ ] Explainer mode only: every stock file has a `LICENSES.md` row; no visual runs over 5 s; no shot type runs twice in a row; no subtitle line breaks inside a number or acronym.
- [ ] `VERIFY.md` written with evidence and limits; original footage untouched; no key printed.
- [ ] Rounds used stated (cap 3).

## Self-Improvement
After each run, ask once: "Any feedback to capture for this skill?" Silence or no: nothing changes. Never ask twice.
- "log this for the skill" / "note this for next time" → draft an entry for `references/learnings.md`, show it,
  write on a confirmed yes. SKILL.md untouched.
- A note on the edit itself ("captions too high", "that whoosh is cheap") → fix the edit, then offer to write it as a
  rule into the brand profile's `DESIGN.md` (that brand only) or into the kit skill it belongs to, shown first, written
  on yes, logged here with the operator's words. Nate's loop: every note becomes a rule, never given twice.
- "update the skill" → show the exact SKILL.md edit, confirm, write, bump the version, one changelog line.
Never write without a confirmed yes. Never promote a logged pattern into SKILL.md in the same session.
On any run after the first, end with the rebuild report: which kit scripts and references were used, and what
was built from nothing that the next run will need again.

## Known limits
Proved on the kit's synthetic demo; the evals are SYNTHETIC until real requests replace them. Avatar explainer mode
comes from one SOP (one 2-minute HeyGen video, one Whisper model) and its timing figures say nothing about `large-v3`.
Local whisper runs through HyperFrames (`large-v3`). ElevenLabs, fal.ai and Kie.ai spend the operator's credits, so every
run names what it used. Platform safe zones in the template are a starting point; check them against the platform's
current layout.
