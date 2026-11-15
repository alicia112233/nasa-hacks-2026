# Scan voice guide

These English prompts were synthesized locally with the installed Microsoft Zira Desktop voice using Windows System.Speech. They contain app instructions only, with no crew data. The app plays the bundled WAV files without contacting a speech service or recording microphone audio.

- Script: `scripts/build-scan-audio.ps1`
- Text: `scripts/scan-prompts.json`
- Format: 22,050 Hz, 16-bit mono PCM WAV
- Regenerate on Windows: `powershell -NoProfile -File scripts/build-scan-audio.ps1`

Voice guidance is optional. Browser playback restrictions or muted device speakers can prevent audible playback; all instructions remain visible.
