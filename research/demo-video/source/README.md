# GhostPilot 30-second demo video: build pipeline

Output: `../ghostpilot-demo-30s.mp4` (1920×1080, 30 fps, 30.0 s, H.264 + AAC).

Timeline: 0–7 s are the seven slides (1 s each), 7–30 s are the recorded app demo with captions and voiceover.

## Rebuild

Run from a working folder that holds these files, with the dev server on http://127.0.0.1:5173:

1. `node shoot-slides.mjs` renders `slides.html` to `slides/s1..s7.png`. It needs the repo's `node_modules` for fonts and Playwright, and `research/deck-assets` for images.
2. `node record.mjs` drives the app with a scripted cursor and writes `rec/frames/*.jpg` plus `rec/timeline.json`. It records at half speed with GPU rendering at 2880×1620, then the compositor restores real time.
3. `python compose.py silent.mp4` builds the silent 30 s video: slide push-ins and crossfades, eased camera zooms from the logged timeline, and a hold over the brief blank frame when the 3D body repaints.
4. Mux the final file:
   `ffmpeg -i silent.mp4 -i audio/vo1.mp3 -i audio/lofi.mp3 -/filter_complex mix.filter -map "[vout]" -map "[aout]" -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -b:a 192k -t 30 ghostpilot-demo-30s.mp4`

`mix.filter` places each voiceover sentence at its on-screen action, ducks the music under the voice and burns in `captions.ass` (Barlow SemiBold from `fonts/`).

## AI-generated media (for the submission's AI-use disclosure)

- Voiceover: ElevenLabs `eleven_v4`, library voice "Matt – Real, Hyper-Conversational".
- Background music: ElevenLabs Music `eleven_music_v2_5`, lo-fi instrumental.
- Recording, compositing and slides were scripted with Claude Code. All app footage is the real GhostPilot build using the sample crew member (synthetic history).
