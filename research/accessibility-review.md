# Crew health accessibility review

13 November 2026 · Chrome on Windows · GhostPilot prototype

The supplied challenge text and audience clarification guided the changes: quick astronaut self-assessment, explicit observations and uncertainty, and a handoff for flight surgeon review. NASA's [five hazards](https://www.nasa.gov/hrp/hazards/) remain the context for the Mission Lens. This is an independent prototype, not NASA-approved medical software.

## Changes

- Replaced the dashboard's four introductory cards with a compact health summary. Six latest indicators, source and observation time, review actions, baseline count, and measurement gaps appear together. The full summary fits within a 1024 × 600 viewport.
- Removed responsive rules that reduced text to 5–8px. Essential text remains at least 12px, with primary reading text and controls generally 14–16px. Improved text contrast, including hover states.
- Gave heart rate and its bpm unit separate layout space. Tested the full placeholder and a three-digit value. Notes wrap in a textarea.
- Constrained dialogs to the available viewport. The crew form scrolls within a visible header and Save action. A focused field scrolls fully above the footer. Very short screens use a compact header and notes field.
- Added a keyboard skip link, current-page and selection states, focusable history/report scroll regions, focus containment and restoration, Escape handling, and inert background/hidden navigation.
- Reflowed the hazard map into readable buttons on narrow screens, with matching visible and accessible names. Motion reduction and forced-color selection outlines are supported.
- Made attention optional. Skipping the task leaves reaction time unrecorded; ending early discards partial results. Personal and simulated observations remain distinct.

## Verification

| Check | Result |
| --- | --- |
| Deterministic unit tests | 13 passed |
| TypeScript | Passed |
| Production build and offline asset cache | Passed |
| Browser regression cases | All 25 cases have passing results: 23 passed in the full run; the two accessibility scan cases passed targeted reruns after their findings were fixed |
| Layout matrix | 9 viewports × 6 routes; no page-level horizontal overflow |
| Check-in layout | 9 viewports; Close and Save remain visible, placeholder fits, focused notes stay above the footer |
| At-a-glance summary | Entire section and review controls visible at 1024 × 600 |
| Axe scans | Zero reported violations across 21 final desktop/mobile view and dialog scans using WCAG 2 A/AA, 2.1 A/AA, and 2.2 AA tags |
| Keyboard | Skip link, dialog/menu focus containment, Escape and trigger restoration passed |
| Saved records | Skipped attention remains unrecorded after reload; entered heart rate persists |
| Existing workflows | Attention inputs, actions, downloads, synthetic/personal separation, fake-camera capture, local source video, and production offline reloads passed |
| Display preferences | Increased text spacing, reduced motion, and forced colors checks passed |

The layout sizes were 1440 × 900, 1366 × 768, 1024 × 600, 800 × 600, 390 × 844, 320 × 568, 568 × 320, 640 × 480, and 320 × 240. The last two represent CSS viewports equivalent to 200% and 400% zoom on a 1280 × 960 display. They are reflow simulations, not manual browser zoom tests.

The 21 final axe scans cover six main views at desktop and mobile widths, the flight-check introduction, crew form, movement evidence, ground report, and mobile navigation. The automated checks run with reduced motion so entrance animations do not distort contrast measurements. Tests do not suppress failing rules or exclude app regions.

## Review images

- [1024 × 600 overview](../test-results/crew-overview-small-laptop.png)
- [1024 × 600 crew form](../test-results/crew-check-small-laptop.png)
- [390 × 844 overview](../test-results/crew-overview-mobile.png)

## Reproduce and limits

Run the development server on port 5173 and production preview on 4173. Use `npm.cmd run test:a11y` for the focused suite, `npm.cmd run test:e2e` for all browser cases, and `npm.cmd test` for deterministic rules. Camera tests use a synthetic camera, not the user's hardware.

Automated checks and screenshot inspection do not establish complete WCAG conformance. Manual NVDA/JAWS, real browser zoom, touch-device use, and task-based review with astronauts and flight surgeons remain necessary. No clinical validation or NASA certification was performed. Blood pressure, glucose, temperature, sleep duration, radiation, bone density, immune function, and habitat conditions are not measured by this prototype.
