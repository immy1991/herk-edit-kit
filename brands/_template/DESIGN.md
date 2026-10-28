# <Brand name> — Video Profile

Copy this folder to `brands/<brand-slug>/`, fill every `<...>`, and delete any line that does not apply.
`npm run new-video -- <slug> --brand <brand-slug>` copies this file into the project as `DESIGN.md`,
`tokens.css` into `assets/brand-tokens.css`, and `logo.png` (or `.svg`) into `assets/`.
Where this profile and the kit's playbook disagree, this profile wins for this brand's videos.

## Style Prompt

<One paragraph: who the videos speak to, the look in plain words, what graphics are for, what they must never feel like.>

## Colors

| Token | Hex | Role |
|---|---|---|
| `--brand-bg` | `<#000000>` | Primary background |
| `--brand-surface` | `<#000000>` | Cards, panels |
| `--brand-border` | `<#000000>` | Hairlines, dividers |
| `--brand-accent` | `<#000000>` | Captions, numbers, the speaker's words |
| `--brand-text` | `<#000000>` | Headings, a second voice |
| `--brand-text-dim` | `<#000000>` | Meta text, labels |

<One line on what each colour means, e.g. "Accent means the speaker. Nothing else carries colour.">

## Typography

- Font: <family>. Weights: <caption weight>; <emphasis weights>.
- Headings in cards: <sentence case / title case>.

## Captions and hook (9:16 reels)

- Case: <lowercase / sentence case / uppercase>. Punctuation: <kept / removed>.
- At most <n> characters and <n> words per cue. Position: <y %>; never over the mouth.
- Text hook in the first 3 seconds: <yes, n words or fewer, position / no>.
- Keep everything out of the platform zones: top 10%, bottom 20%, right rail x > 83% below y 50% (check your platform).

## Logo

- File: `logo.png` in this folder. Never recolor, stretch or add a glow.
- End card: <none / logo end card, n seconds>. CTA card: <none / wording>.

## Sound

- Music: <none / a bed at about -n dB under the voice, genre>.
- Voice levelled to about <-16> LUFS, true peak at or below -1 dBTP, measured on the delivered stereo file.
- Sound effects: <only on visible actions, soft palette / none>.

## Motion Rules

- Entrances <ease, duration>; exits <ease, duration>. One motion vocabulary per video.
- Graphics appear on the first word of the phrase that names them and leave when the next idea starts. Hold text at least 2 s.

## Voice rules (checked on every on-screen word)

- Banned words: <list>.
- Never put a client name, figure, result or claim on screen unless it is in the source footage and the client has cleared it.
- <Industry rules, e.g. no outcome promises, required disclaimers.>

## What NOT to Do

1. <...>
2. No AI still image as B-roll; stills may only seed AI video.
3. No invented numbers, results or testimonials.
4. No `Math.random()` / `Date.now()` in a render.

## File References

- `logo.png` — logo
- `tokens.css` — the `:root` variables every composition for this brand imports
