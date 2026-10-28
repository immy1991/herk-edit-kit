# Setup (once per machine)

## Contents
1. Install the kit
2. Install the skill
3. Settings
4. API keys
5. Your first brand profile
6. Check it works

## 1. Install the kit
Needs Node.js 22 or newer, Git, FFmpeg (with ffprobe) and Chrome or Chromium.

```sh
git clone https://github.com/immy1991/herk-edit-kit.git
cd herk-edit-kit
npm ci
npm run setup
npm test
```

`npm run setup` checks the tools and creates `.env` if it is missing. Local transcription uses whisper.cpp through
HyperFrames; `npx hyperframes doctor` says whether `whisper-cli` is found.

## 2. Install the skill
Copy the skill folder into your skills folder:

- Claude Code: `cp -R skill/herk-edit ~/.claude/skills/`
- Codex: `cp -R skill/herk-edit ~/.agents/skills/`

Start a new session so the skill loads.

## 3. Settings
Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```sh
export HERK_KIT="$HOME/herk-edit-kit"      # where you cloned the kit
# export HERK_BRANDS="$HOME/brand-profiles" # optional: keep profiles outside the kit
```

Without `HERK_BRANDS`, profiles live in `$HERK_KIT/brands/`. Profiles are gitignored either way.

## 4. API keys
All optional. Put them in `$HERK_KIT/.env`, never in a profile or a project file.

| Key | Used for |
|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs Scribe transcription, when local whisper is too slow or inaccurate |
| `FAL_KEY` | AI video B-roll through fal.ai (the default generator) |
| `KIE_API_KEY` | AI video B-roll through Kie.ai (`--provider kie`) |

Details and prices: `$HERK_KIT/docs/TOOLS-AND-API-KEYS.md`.

## 5. Your first brand profile
Ask the skill: "set up a brand profile for my videos". It copies `brands/_template/` to `brands/<slug>/`, asks for
colours, font, caption style, music, end card and voice rules in one message, and shows the result before writing.
Add the logo yourself as `brands/<slug>/logo.png` (or `.svg`). One folder per brand; a client gets their own folder.

## 6. Check it works
```sh
cd "$HERK_KIT"
npm run check
npx hyperframes doctor
npm run new-video -- test-clip --brand <slug>
cat video-projects/test-clip/meta.json   # shows "brand": "<slug>"
```
Then render the starter: `cd video-projects/test-clip && npx hyperframes render --quality draft`.
