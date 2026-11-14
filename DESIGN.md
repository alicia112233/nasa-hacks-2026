---
name: GhostPilot
description: Crew procedure cards for a long-mission self-check, printed in black ink on matte card stock.
colors:
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

Every surface is a printed flight-data-file card clipped to a slate binder. Matte card stock carries black ink: 1.5px rules, square check boxes, numbered steps with their times, condensed uppercase labels. The body itself is drawn as a manual illustration (a three-tone toon render with an ink outline and hatching) and serves as a lettered index; picking a region fills it amber and opens its card. The world reads as an operational document, not as a screen.

Density is a checklist's density: rows sit at 46 to 56px, separated by full-width ink rules rather than boxes, and there is one red action per card. Colour is spent sparingly and by meaning. Amber means caution or "selected", red means a trend alert or the one primary action, and the five NASA hazard inks appear only as the card's edge tabs and as chart lines for the matching data.

The world rejects the dark holographic body-scan dashboard and the rounded wellness-tile grid. Nothing glows, nothing is glass, and nothing is rounded beyond the 3px of a cut card corner.

**Key Characteristics:**
- Card stock panels on a slate binder ground, with a solid black top bar.
- Black 1.5px rules divide content, and square marks carry state.
- Barlow Condensed uppercase for every label, number and heading; Barlow for sentences.
- Amber marks caution and selection; red marks trend alerts and the single primary action.
- Diagonal hatching means "not measured / needs instrument" wherever it appears: on the 3D body, in keys, and in check boxes.
- The body is a toon-shaded manual illustration with ink outlines, never a photoreal or glowing scan.

## Colors

A printed palette: warm paper, slate, black ink, plus two safety inks and five hazard inks that each carry exactly one meaning.

### Primary
- **Caution Amber** (amber): NOTE frames (3px border), the selected region (body fill, tag and list row), the current-page underline in the top bar, the focus ring, selection highlight and status labels such as DEMO DATA. **Amber Tint** (amber-tint) marks the active row in ledgers.

### Secondary
- **Signal Red** (red): the primary BEGIN action, the TREND label inside a note, trend tags and markers on the body and in the region list, worsening values in ledgers, a trend line in charts, and destructive buttons. **Red Deep** (red-deep) is the primary hover. **Red Tint** (red-tint) is the hover wash of the outlined destructive button.

### Tertiary: Hazard inks
- **Radiation Violet** (hazard-radiation), **Isolation Blue** (hazard-isolation), **Distance Green** (hazard-distance), **Gravity Rust** (hazard-gravity), **Habitat Teal** (hazard-habitat): full-height vertical tabs on the left edge of a procedure card, with white condensed labels set vertically. They also colour hazard keys and the matching NASA data line (radiation dose in violet, habitat air in teal). The source of truth for these values is the `hazards` array in `src/body.mjs`.

### Neutral
- **Slate Binder** (binder): the page ground behind every card and the background of the docking task.
- **Card Stock** (stock): every panel, card, sheet and dialog, and the text on ink surfaces. **Stock 2** (stock-2) is the hover wash for rows and buttons and the 3D stage ground. **Stock 3** (stock-3) draws hairline dividers (1px) inside lists and ledgers.
- **Field Paper** (field-paper): the brighter writing surface inside inputs.
- **Ink** (ink): text, 1.5px rules, the top bar, letter tabs, region tags, filled check boxes and active segments. **Ink 2** (ink-2) is secondary labels, and **Muted** (muted) is captions, sub-labels and "needs instrument" rows.
- **Body map fills** (fill-trend, fill-reported, fill-done, fill-unmarked): the pale state fills painted onto the 3D body and repeated as swatches in its key.

### Named Rules
**The One Meaning Rule.** Amber always means caution or selection, red always means a trend alert or the single primary action, and each hazard ink always means its hazard. A colour never doubles as decoration.

**The Single Red Button Rule.** A card carries at most one red filled button (BEGIN). Every other action is a 1.5px ink outline or a text link.

**The Amber Note Rule.** Every note is framed in amber, whatever its cause. A trend note shows its severity through a red TREND label inside the amber frame, not through a red frame.

## Typography

**Display Font:** Barlow Condensed 500/700 (with Arial Narrow, sans-serif)
**Body Font:** Barlow 400/600 (with system-ui, sans-serif)

**Character:** A stencilled checklist voice. The condensed face is always uppercase and letterspaced, and it carries every name, number and time. The humanist Barlow carries only sentences and check names, so a full line of prose always reads as a sentence, never as a label.

### Hierarchy
- **Display** (700, 46px, 1; 34px under 640px): the procedure card title (HEAD, CHEST), uppercase, beside its letter tab.
- **Headline** (700, 30px, 1.05; 26px on phones): sheet titles on Trends, Handoff and Mission, uppercase, with an optional 17px muted condensed suffix.
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

The page is a 1480px max-width column on the binder, with a `gap` gutter of 24px (12px under 640px) around and between cards. The Body view is a two-column grid: a sticky crew index (minmax(340px, 5fr)) that fills the viewport height below the 56px bar (560 to 920px tall), beside the procedure card (7fr). The index stacks a 3D stage over a three-column region list (two columns under 640px, one under 380px) and a state key. Trends uses a 5fr/7fr sheet grid, and Handoff and Mission use equal halves. A sheet can span both columns.

Under 900px every grid collapses to one column, and the index becomes a 56vh stage that is no longer sticky. Under 640px the top bar wraps, so the nav drops to its own horizontally scrolling row. On short screens (height 640px or less, width above 900px, the 1024x600 case) the card title drops to 38px and the rows tighten to 46px.

Inside a procedure card the step row is a fixed grid: number (44px), name, time, check box (28px) and chevron (18px). Expanded step bodies indent 56px so that they align with the name. Touch targets are at least 44px for buttons and 40px for segments and choices.

## Elevation & Depth

Flat. Cards sit on the binder with no shadow, and the contrast of paper against slate does the separating. Depth inside a card comes from ink rules and hover washes, never from layering. Only things that truly float above the page cast a shadow.

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
The left edge holds a 34px strip of hazard tabs (26px on phones). Each tab is a full-height block of its hazard ink with a vertical white label and links to the NASA hazard page. The head is a 56px black letter tab with the region letter in 36px stock, then the Display title, then a right-aligned tabular check count and total time. Below it sits an amber NOTE when a flag or report exists, then numbered step rows between 1.5px ink rules, each with a muted condensed sub-label, a time, and a 26px square check box (ink-filled when done, red-cornered when trending, hatched when it needs an instrument). The foot holds the NASA risk links in caption type and one red BEGIN.

### Caution Note
A 3px amber frame with 12px/16px padding. A condensed uppercase label block sits on the left: an amber fill with ink text for a report, or a red fill with white text for TREND. The sentence and a follow-up link sit beside it.

### Crew Card
A row above the 3D stage (never over it, so it can't cover a region tag) holds two outlined buttons: Profile, a toggle that opens the crew card and fills amber while it is open (like a picked region), and Scan me (Rescan once scanned), which opens the camera directly. Who is shown is chosen in the top bar's crew switch, whose Edit profile opens the crew card in place of the region card and clears the body's region selection. The crew card has an ink edge tab labelled CREW (never a hazard ink) and the initials in the letter tab. It has no steps, times or red action. The name (the Display title) and the mission under it edit in place: each shows a muted pencil, underlines on hover, and becomes a field on click (Enter or leaving saves, Escape cancels). A newly added member opens with the name field ready to type. Below sits one Body list of label / control rows between hairlines (Scan, Body, Build, Height, Mass), and every control saves as it changes. When others are on the roster, an outlined red Remove from crew asks for confirmation before removing the member and their records.

### Crew Body Index (signature)
The toon-shaded GLB body sits on a stock stage, with lettered 26px square region tags joined to it by leader lines. Tag states are ink (default), red (trend), an amber double ring (reported) and an amber fill (selected). The matching region list repeats the letters as 24px ink squares, adds a 10px square state swatch, and marks a pressed row with an amber fill. A key below names the four body fills (trend, reported, done today, not measured/hatched).

### Ledger
A full-width table with condensed 14px uppercase heads over a 1.5px ink rule and 1px stock-3 row hairlines. Numbers are tabular. The active row takes Amber Tint, and a worsening last value is red and bold.

### Charts
Recharts lines on stock: a stock-3-toned grid with horizontal lines only, an ink axis with condensed 12px ticks, a 2px ink data line (red when worsening), the ghost baseline as a dashed `#7a7466` reference line, and tooltips as square stock boxes with a 1.5px ink border. Hazard data uses its hazard ink.

### Dialog
A stock panel up to 560px wide (1000px for the wide variant) under a sticky black head with a condensed 24px uppercase title and a 44px icon close button, over a 60% ink scrim.

## Do's and Don'ts

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
