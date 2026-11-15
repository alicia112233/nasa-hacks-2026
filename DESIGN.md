---
name: GhostPilot
description: Crew procedure cards for a long-mission self-check, printed in black ink on matte card stock.
colors:
  space: "#060a12"
  space-2: "#0d1626"
  binder: "#5b6770"
  stock: "#f4f1e8"
  stock-2: "#ebe6d8"
  stock-3: "#ddd6c4"
  field-paper: "#fbfaf6"
  ink: "#111111"
  ink-2: "#33322f"
  muted: "#55534d"
  amber: "#e0a100"
  amber-tint: "#f4e3b2"
  red: "#c8102e"
  red-deep: "#a50d26"
  red-tint: "#f6d3d7"
  complete: "#3a7d2c"
  fill-trend: "#e9a3ab"
  fill-reported: "#f1d27e"
  fill-done: "#d7d1bf"
  fill-unmarked: "#ece7da"
  hazard-radiation: "#8e2a8b"
  hazard-isolation: "#2e6f9e"
  hazard-distance: "#1f7a5c"
  hazard-gravity: "#9c5419"
  hazard-habitat: "#0f7c86"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "46px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.05
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "0.04em"
  figure:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  step:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.06em"
  label-small:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    letterSpacing: "0.06em"
rounded:
  none: "0px"
  sheet: "3px"
spacing:
  gap: "24px"
  gap-compact: "12px"
  card-pad: "26px 32px 28px"
  sheet-pad: "24px 28px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.stock}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 26px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.red-deep}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 18px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.stock-2}"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    typography: "{typography.label}"
    height: "40px"
  input-field:
    backgroundColor: "{colors.field-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
  top-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    height: "56px"
  procedure-card:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.card-pad}"
  sheet:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.sheet-pad}"
  letter-tab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    size: "56px"
  region-tag:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    size: "26px"
  region-tag-trend:
    backgroundColor: "{colors.red}"
    textColor: "{colors.stock}"
  region-tag-selected:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
  status-label:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    typography: "{typography.label-small}"
    padding: "2px 8px"
---

# Design System: GhostPilot

## Overview

**Creative North Star: "The Crew Procedure Card"**

Every surface is a printed flight-data-file card held up against a window onto space. Matte card stock carries black ink: 1.5px rules, square check boxes, numbered steps with their times, condensed uppercase labels. The body itself is drawn as a manual illustration (a three-tone toon render with an ink outline and hatching) and serves as a lettered index; picking a region fills it amber and opens its card. The world reads as an operational document, not as a screen.

Density is a checklist's density: rows sit at 46 to 56px, separated by full-width ink rules rather than boxes, and there is one red action per card. Colour is spent sparingly and by meaning. Amber means caution or "selected", red means a trend alert or the one primary action, and the five NASA hazard inks appear only as the card's edge tabs and as chart lines for the matching data.

The world rejects the dark holographic body-scan dashboard and the rounded wellness-tile grid. Nothing glows, nothing is glass, and nothing is rounded beyond the 3px of a cut card corner.

**Key Characteristics:**
- Card stock panels against the window (deep space, slow-drifting stars), with a solid black top bar.
- Black 1.5px rules divide content, and square marks carry state.
- Barlow Condensed uppercase for every label, number and heading; Barlow for sentences.
- Amber marks caution and selection; red marks trend alerts and the single primary action.
- Diagonal hatching means "not measured / needs instrument" wherever it appears: on the 3D body, in keys, and in check boxes.
- The body is a toon-shaded manual illustration with ink outlines, never a photoreal or glowing scan.

## Colors

A printed palette: warm paper, deep space, black ink, plus two safety inks and five hazard inks that each carry exactly one meaning.

### Primary
- **Caution Amber** (amber): NOTE frames (3px border), the selected region (body fill, tag and list row), the current-page underline in the top bar, the focus ring, selection highlight and status labels such as NEXT. **Amber Tint** (amber-tint) marks the active row in ledgers.

### Secondary
- **Signal Red** (red): the primary BEGIN action, every alert label inside a note (ALERT, WATCH, TELL SURGEON, ACT NOW), alert tags and markers on the body and in the region list, worsening values in ledgers, a trend line in charts, and destructive buttons. **Red Deep** (red-deep) is the primary hover. **Red Tint** (red-tint) is the hover wash of the outlined destructive button.

### Complete
- **Complete Green** (complete): done, in the Today rings' fill, the region letters of a finished region and the eye chart's clear lines. Nothing else is green, so it never reads as a hazard ink.

### Tertiary: Hazard inks
- **Radiation Violet** (hazard-radiation), **Isolation Blue** (hazard-isolation), **Distance Green** (hazard-distance), **Gravity Rust** (hazard-gravity), **Habitat Teal** (hazard-habitat): full-height vertical tabs on the left edge of a procedure card, with white condensed labels set vertically. They also colour hazard keys and the matching NASA data line (radiation dose in violet, habitat air in teal). The source of truth for these values is the `hazards` array in `src/body.mjs`.

### Neutral
- **Space** (space, space-2): the window behind every card, a vertical gradient from deep space to a slightly lighter navy at the bottom. Two sparse star layers (faint far points, a few brighter near ones, a third of them faintly blue or warm) drift left at different speeds as the station orbits, the near layer twinkles gently, a thin shooting star crosses now and then (under a second, on 17 s and 29 s cycles), and Earth's blue glow along the lower edge brightens and fades over about 70 seconds, like orbital day and night. It stays behind everything, never carries text, has no animation for reduced motion, and is hidden in print.
- **Slate Binder** (binder): the background of the docking task.
- **Card Stock** (stock): every panel, card, sheet and dialog, and the text on ink surfaces. **Stock 2** (stock-2) is the hover wash for rows and buttons and the 3D stage ground. **Stock 3** (stock-3) draws hairline dividers (1px) inside lists and ledgers.
- **Field Paper** (field-paper): the brighter writing surface inside inputs.
- **Ink** (ink): text, 1.5px rules, the top bar, letter tabs, region tags, filled check boxes and active segments. **Ink 2** (ink-2) is secondary labels, and **Muted** (muted) is captions, sub-labels and "needs instrument" rows.
- **Body map fills** (fill-trend, fill-reported, fill-done, fill-unmarked): the pale state fills painted onto the 3D body and repeated as swatches in its key.

### Named Rules
**The One Meaning Rule.** Amber always means caution or selection, red always means an alert or the single primary action, Complete Green always means a check done today, and each hazard ink always means its hazard. A colour never doubles as decoration.

**The Single Red Button Rule.** A card carries at most one red filled button (BEGIN). Every other action is a 1.5px ink outline or a text link.

**The Amber Note Rule.** Every note is framed in amber, whatever its cause. An alert shows its severity through a red label inside the amber frame (ALERT for a reading off the ghost, or the urgency word for a symptom or vital), not through a red frame.

## Typography

**Display Font:** Barlow Condensed 500/700 (with Arial Narrow, sans-serif)
**Body Font:** Barlow 400/600 (with system-ui, sans-serif)

**Character:** A stencilled checklist voice. The condensed face is always uppercase and letterspaced, and it carries every name, number and time. The humanist Barlow carries only sentences and check names, so a full line of prose always reads as a sentence, never as a label.

### Hierarchy
- **Display** (700, 46px, 1; 34px under 640px): the procedure card title (HEAD, CHEST), uppercase, beside its letter tab.
- **Headline** (700, 30px, 1.05; 26px on phones): sheet titles on Trends, Report, Risks and Sources, uppercase, with an optional 17px muted condensed suffix.
- **Title** (700, 20px, 0.04em): sub-section heads within a sheet, uppercase, always below a 1.5px ink rule.
- **Figure** (700, 34px, 1, tabular): headline numbers in data figures. The step numbers (26px) and the letter tab (36px) use the same condensed bold.
- **Step** (Barlow 600, 18px, 1.25): check names in the step rows.
- **Body** (Barlow 400, 16px, 1.5): sentences, note text and inputs. Footnotes such as NASA risk lists stay within 60ch.
- **Caption** (Barlow 400, 13px): provenance, figure captions and source lists, in muted ink.
- **Label** (Condensed 700, 15 to 17px, 0.06em, uppercase): buttons (17px), segments, field labels and choices. **Label small** (Condensed 500, 14px, 0.06em, uppercase): keys, sub-labels under check names and figure units.

### Named Rules
**The Uppercase Condensed Rule.** Labels, numbers, times, headings and buttons are set in Barlow Condensed, uppercase and letterspaced (0.04 to 0.14em). Sentences are never uppercase.

**The Tabular Numbers Rule.** Every number that can change (times, sols, figures, ledger values) uses tabular figures.

## Layout

The page is a 1480px max-width column against the window, with a `gap` gutter of 24px (12px under 640px) around and between cards. The Body view is a two-column grid: a sticky crew index (minmax(340px, 5fr)) that fills the viewport height below the 56px bar (560 to 920px tall), beside the procedure card (7fr). The index stacks a 3D stage over a three-column region list (two columns under 640px, one under 380px) and a state key. Trends uses a 5fr/7fr sheet grid, Report uses 7fr/5fr, and Sources uses equal halves; Risks is one full-width sheet with the whole ledger on the page (no inner scroll), stacking each risk into a block under 640px. A sheet can span both columns.

Under 900px every grid collapses to one column, and the index becomes a 56vh stage that is no longer sticky. Under 640px the top bar wraps, so the nav drops to its own horizontally scrolling row. On short screens (height 640px or less, width above 900px, the 1024x600 case) the card title drops to 38px and the rows tighten to 46px.

Inside a procedure card the step row is a fixed grid: number (44px), name, time, check box (28px) and chevron (18px). Expanded step bodies indent 56px so that they align with the name. Touch targets are at least 44px for buttons and 40px for segments and choices.

## Elevation & Depth

Flat. Cards sit against the window with no shadow, and the contrast of paper against deep space does the separating. Depth inside a card comes from ink rules and hover washes, never from layering. Only things that truly float above the page cast a shadow.

### Shadow Vocabulary
- **Dialog lift** (`box-shadow: 0 18px 50px rgba(0, 0, 0, .35)`): modal dialogs over a 60% ink scrim.
- **Toast lift** (`box-shadow: 0 10px 28px rgba(0, 0, 0, .3)`): the ink toast in the bottom-right corner.

### Named Rules
**The Paper Doesn't Float Rule.** Cards, sheets and the index never cast shadows. Only dialogs and toasts do.

## Shapes

Square by default. Buttons, inputs, tags, check boxes, segments, chips and status labels all have 0 radius. Cards, sheets and the index have a 3px corner, like trimmed card stock. The only circle is the docking target in the attention task. Borders are 1.5px ink (`--rule`) for structure and controls, 1px stock-3 for hairlines inside lists, 3px amber for notes, and 1.5px dashed muted ink to fence off the danger zone. State marks are small squares, never dots: 10px swatches in region rows, a 9px red corner on a flagged check box, and the live indicator. Hatching is a 45-degree repeating ink line (1.5px on a 7px pitch).

On the 3D body the same language holds: a three-step toon ramp (shadow, mid, paper), an ink back-face outline, and screen-space diagonal hatching on regions that are not measured. Leader lines run from the tags to the body as 1px ink polylines, thickening to 2px when active.

## Components

### Buttons
Blunt and stencilled.
- **Shape:** square (0).
- **Primary:** Signal Red fill and border, white condensed label, 44px tall with 26px side padding and an optional 16px leading icon. Hover goes to Red Deep.
- **Outline (default):** a 1.5px ink border, transparent fill and ink label. Hover washes to Stock 2.
- **Ghost:** borderless until hover, when the ink border appears.
- **Destructive:** an outlined red button (red border and label, Red Tint on hover) or a filled red button, kept behind a dashed divider.
- **Disabled:** 45% opacity.
- **Focus (all interactive elements):** a 3px amber outline with a 2px offset.

### Segmented control and choices
A 1.5px ink frame with internal ink dividers. The pressed state inverts to an ink fill with stock text. Choice buttons for answers follow the same pattern as separate outlined squares.

### Inputs / Fields
- **Style:** a 1.5px ink border, Field Paper fill, 0 radius and 10px/12px padding, with Barlow 16px text. The label above is a condensed uppercase Label.
- **Range and checkbox:** native controls with an ink accent colour. Checkboxes are 20px.
- **Focus:** the global amber ring.

### Navigation
The black 56px top bar holds the wordmark (Condensed 700, 22px, 0.1em) and the nav links (Condensed 500, 18px, uppercase, `#c9c5bb`). Hover turns a link to stock, and the current page gets stock text with a 3px amber underline that runs flush to the bar's bottom edge. Status labels and the sol readout sit at the right in tabular figures, then the crew switch: the selected crew member's initials in a 32px stock square and their name, in a 1.5px frame that brightens on hover. It names who every page is showing. It opens a stock panel under the bar (toast lift), listing the crew with initials squares and scan status, the current member washed in Amber Tint and ticked, then Edit profile and Add crew member. It is a disclosure: Tab moves through it, and Escape or leaving closes it. Initials stand in for a face, because GhostPilot keeps no photos. The one-way delay lives on the Handoff page. On phones the nav moves to its own scrolling row, the name truncates, and under 380px only the initials show.

### Cards / Containers
- **Corner Style:** 3px.
- **Background:** Card Stock.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 26px/32px for a procedure card and 24px/28px for a sheet (both 16 to 18px on phones).
- **Sheet heads:** a Headline, then Title subsections, each under a 1.5px ink rule.

### Procedure Card (signature)
The left edge holds a 34px strip of hazard tabs (26px on phones). Each tab is a full-height block of its hazard ink with a vertical white label and links to the NASA hazard page. The head is a 56px black letter tab with the region letter in 36px stock, then the Display title, then a right-aligned tabular check count and total time. Below it sits an amber NOTE when a flag or report exists, then numbered step rows between 1.5px ink rules, each with a muted condensed sub-label, a time, and a 26px square check box (ink-filled when done, red-cornered when trending, hatched when it needs an instrument). The foot holds the NASA risk links in caption type and one red BEGIN. The head's right side tracks progress through the actionable checks only (instrument and NASA-data rows stay outside the count, and carry no step number): "2 of 7 complete" in condensed 700, then a 12px square per check (ink when done, amber for the next) and the time left. The next check's row carries a small amber NEXT label beside its time, and the red button reads Begin, then Continue, with the next check named in its accessible description. When every actionable check is done, a done panel in a 1.5px ink frame replaces the button: an ink-filled done box, the outcome in one line ("All 3 done. Added to today's report."), then one red action, Next: the next region with checks left, or Open today's report when none are left. Above the card, an ink-on-stock Today button returns to the Today view.

### Caution Note
A 3px amber frame with 12px/16px padding. A condensed uppercase label block sits on the left: an amber fill with ink text for a report, or a red fill with white text for TREND. The sentence sits beside it. Below the sentence sits "what to do": up to three numbered plain steps (condensed tabular numbers, Barlow sentences), each with its action as a text link beside it (Retake, Hand off). Every label is red. A reading off the ghost reads ALERT; a reported symptom, a Low or Very low rating, or an out-of-range vital (resting heart rate over 100 or under 50) says how urgent it is (Watch, Tell surgeon, Act now), and Act now outranks both. The saved result's sub-label adds a few words of what to do behind a 9px red square. A check with a not-applicable answer shows it as the first choice (No spacewalk). Under Act now, Hand off becomes an outlined button. An opened check starts with two label / sentence lines, HOW and WHY, before its controls. A saved check's sub-label becomes its result ("Today 64 bpm · ghost 62 bpm"); a clearly off result gets ink text behind a 9px amber square.

### Profile Dialog
A row above the 3D stage (never over it, so it can't cover a region tag) holds Scan me (Rescan once scanned), which opens the camera directly, and the figure-source caption. Profile editing is reached through Edit profile in the top bar's crew switch. It opens the standard dialog on any page, preserving the current page and body region. The popup shows the member's initials beside their name, with no hazard tabs, steps or times. The name (34px condensed) and the mission under it edit in place: each shows a muted pencil, underlines on hover, and becomes a field on click (Enter or leaving saves, Escape cancels). A newly added member opens with the name field ready to type. Below sits one Body list of label / control rows between hairlines (Scan, Avatar model, Build, Height, Mission start with "Today is Sol N", Mass), with no helper captions beyond Build's "From scan", and every control saves as it changes. Mass is always a typed number: the camera cannot weigh anyone. Under the list, Scan history is a small ledger (Date, Type, Clip, Thigh, then four breadths as % against the standard figure), newest first, with the scan shaping the figure on the Amber Tint row labelled SHAPES FIGURE. A Clip column plays the scan's saved seconds in a figure under the table. It shows six rows, then Show all, and scrolls inside its own region on phones. Each row ends in a trash icon button; deleting opens an amber-framed confirmation strip under the table (focus on Cancel) that says what will change, with a filled red Delete. The head links to the thigh trend in H Legs. Scan me / Rescan opens the camera from the popup too. Done, Close, Escape or clicking the scrim dismisses the popup and restores focus to the crew switch. When others are on the roster, an outlined red Remove from crew asks for confirmation before removing the member and their records.

### Scan Review

The scan occupies the full window. Capture uses a contained, uncropped camera view with one centered instruction card in translucent card stock (74% stock, a 50% ink rule, 3px corner), so the body and its measuring lines stay visible through it. It uses the app's own scale: the Display heading (46px, 34px on phones), 20px guidance (18px on phones), and the positioning reminder in label-small under a hairline inside the card, never over the feet. While scanning, the seconds count sits at the card's left as a 56px ink letter tab, outside the live region so it is not announced every second. The review head is a 30px Headline. Voice guide, Repeat instruction and optional browser Full screen controls stay above the camera; Close remains in the black dialog head. Positioning, scanning and completion have matching bundled spoken prompts, with mute and playback-failure recovery. Review keeps the evidence layout below inside a centered full-window sheet.
The body scan's result, in the wide dialog. Left: the recorded clip and the fitted figure as two equal portrait panels with condensed captions under them (the clip's playback strip sits under its picture on ink: play / pause, a stock-accent range, tabular seconds), then the Avatar model and Build segments and one FIGURE line. Female/Male is explicitly the crew member's model choice, retained through retakes and rescans. New members see an unselected model choice, a labelled provisional preview, and must choose before Use scan becomes available. Right: the breadth rows (label, bar, tabular percentage) under a key and a NARROWER / 0 / WIDER axis, then BASELINE, ACCURACY and LEGS as label / sentence lines like HOW and WHY. A bar is a Stock 2 track with an ink tick at the baseline; the measurement is an 8px ink block, the fitted figure a 16px open ink square, and the frame scatter a darker band behind the block. The block inside the square means the figure matches the measurement. The action row (red Use scan, ghost Retake) is pinned to the dialog's bottom edge under a 1.5px ink rule, so it stays in reach on short screens. Under 820px the two sides stack. The Legs check opens this same scan; its review adds a Legs line (thigh in cm, against the ghost when one exists). In the crew bar, a muted condensed caption states the figure's source: "Figure fitted to scan · date" or "Standard figure · not scanned".

### Crew Body Index (signature)
The toon-shaded GLB body sits on a stock stage, with lettered 26px square region tags joined to it by leader lines. Tag states are ink (still to do), red (any alert), Complete Green (done for today, or nothing due) and an amber fill (selected). The matching region list repeats the letters as 24px squares in the same three state colours and marks a pressed row with an amber fill. The body fills follow: a red tint for an alert, a Complete Green tint (#c5d4b9) for done, stock otherwise, hatched when never measured. A key below names alert, done for today, to do and not measured.

### Ledger
A full-width table with condensed 14px uppercase heads over a 1.5px ink rule and 1px stock-3 row hairlines. Numbers are tabular. The active row takes Amber Tint, and a worsening last value is red and bold.

### Charts
Recharts lines on stock: a stock-3-toned grid with horizontal lines only, an ink axis with condensed 12px ticks, a 2px ink data line (red when worsening), the ghost baseline as a dashed `#7a7466` reference line labelled with its value, the ghost's sols shaded `#d9d3c3` (GHOST, top left) and the last 3 readings shaded `#f4e3b2` (LAST 3, top right) so the summary above names exactly what is shaded, a fixed 1–5 integer axis for ratings, and tooltips as square stock boxes with a 1.5px ink border. Hazard data uses its hazard ink.

### Eye chart
The Eyes check replaces its None / Mild / Strong choices with a near-vision chart inside the step. A step line names the eye in condensed uppercase and the cover instruction ("LEFT EYE · Cover your right eye. Line 4 of 6"), then six 12px square ticks (Complete Green clear, red blurry or unseen, amber current, outlined ahead). The line itself sits in a Field Paper box with a 1.5px ink rule: five Barlow 700 letters, letter-spaced .3em, at 64, 48, 36, 26, 18 then 12px. Clear, Blurry and Can't see are the standard choice buttons. Between eyes a pause states the first eye's result and offers one red Start right eye. The result is a 24px condensed outcome (a 12px red square before Mild or Strong change), a label / value line per eye, then red Save result and a Start again link.

### Dialog
A stock panel up to 560px wide (1000px for the wide variant) under a sticky black head with a condensed 24px uppercase title and a 44px icon close button, over a 60% ink scrim.

### Interactive tutorial

A paper guide sits beside the current real control, framed by an amber spotlight through the ink scrim. A slow outward amber pulse draws attention to the target while its outline stays visible; reduced-motion preferences keep the highlight steady. A centered intro card opens it and a centered summary closes it. Under the black head (Tutorial, Close) a strip of four condensed phase labels names the loop, SPOT · CHECK · COMPARE · ACT, each with a 10px square: ink when done, amber for the current phase, outlined ahead. Each step has a condensed heading, one sentence on what it means, and the goal in a 3px amber frame ("TAP HEAD.") that matches the spotlight. The chart step, which only asks the crew member to read, has a red Next instead of a goal. Back, Skip and Close stay available; Finish appears only on the summary. Other controls are inert during the tour; Tab cycles between the goal and guide controls, and Escape exits. Focus moves to each target with its goal as an accessible description and returns to Tutorial when dismissed. Replay restores the previous page and preserves an unsaved handoff draft.

## Do's and Don'ts

### Operational workflow additions

The Today rings count due checks in the mission plan, including repeats and follow-ups. The caption explicitly says checks completed; named concerns stay visible when the ring is full. Mission plan is a compact disclosure below the report link. Procedure rows show cadence, recording time and preparation separately. Numeric instrument forms use the existing field grid: value (both systolic and diastolic for a cuff), method and measured-at time, followed by Save and an optional equipment-unavailable action. Shared concerns retain the same label, reason and first step on every page. Rating changes are stated in points.

The Report page uses two sheets (7fr / 5fr). Left, the Daily report: Headline, a one-line identity (name · mission · sol · date · demo or personal), a four-cell figure row (Physical, Mental, Trends, Reported), Needs attention as label / sentence rows (a red label: ALERT, WATCH, TELL SURGEON or ACT NOW, then the check, region and first step), Results as a ledger grouped by region (done checks only, off results carry a small label), a Not done today line, and Not measured onboard. Print styles hide everything else, so Save as PDF prints this sheet alone, black on white. Right, Hand off: an optional note, collapsed Follow-up plan and Link sections, one red Hand off today's report, then outlined Save as PDF, Markdown and JSON, and handed-off reports with their reassessments. A day select sits beside the report title (hidden in print); a past day shows its rebuilt report, whether it was handed off, and Back to today. Lists of checks use neutral topic names (src/body.mjs topicOf).

Personal movement evidence starts with the crew video and explicitly linked reference video, their timestamps, frame quality and conditions. Missing video stays visible as a gap. Estimated pose replay is a disclosure below the video; the public 4DGS technical demonstration stays secondary to the labelled synthetic pose example.

On desktop, the column beside the body shows Today until a region is picked: a Headline with the sol, two rings (Physical and Mental) side by side, the Next row (an amber NEXT label, the check in step type, one red Start with its seconds), an amber-framed shared-symptom prompt when applicable, and a Today's report link row. Each ring is a 13px Stock 3 track with one continuous Complete Green arc from 12 o'clock, clockwise, for the share of checks done; the figure (46px done, 20px total) sits in the middle and the name and status line below, with a 9px red square before any named alert. The arc eases up from empty on arrival and to its new length after each check (reduced motion: no animation). A ring with checks left is a button that starts its next check. Conditions & ghost lives at the top of Trends. The body index remains alongside it. Unreliable comparisons use an amber-framed explanation with text; they do not receive the red trend marker. Each metric shows when it was last measured. At narrow widths panels stack and controls wrap; the Emergency control stays available.

### Do:
- **Do** separate content with full-width 1.5px ink rules and 1px stock-3 hairlines instead of boxes or shadows.
- **Do** set every label, number, time and heading in uppercase Barlow Condensed, with tabular figures for numbers that change.
- **Do** keep each card to one red filled action. Everything else is an ink outline or an underlined link.
- **Do** mark "not measured / needs instrument" with the 45-degree ink hatch, in 2D and in 3D alike.
- **Do** use square marks for state: check boxes, swatches, corner flags and tags.
- **Do** frame every note in 3px amber, and show severity with the label block inside it.
- **Do** use a hazard ink only for its own hazard: card edge tabs, keys and that hazard's data line.

### Don't:
- **Don't** add rounded corners beyond the 3px card corner, or pill-shaped controls.
- **Don't** put shadows on cards, sheets or the body index. Only dialogs and toasts lift.
- **Don't** use dark glowing panels, gradients or glass. This is printed card stock, not a holographic body-scan dashboard.
- **Don't** arrange checks as a grid of rounded wellness tiles. They are numbered rows on a card.
- **Don't** use red for anything other than a trend alert, the primary action or a destructive action.
- **Don't** set a small uppercase kicker or eyebrow line above a title. The letter tab beside the title does that job.
- **Don't** render the body photoreal, translucent or glowing. It is a three-tone toon illustration with an ink outline.
