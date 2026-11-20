---
name: shots
description: Take headless iPhone screenshots of the key mobile screens and compare before/after. Use when the user says "/shots", "shots", "screenshot the mobile ui", or wants to check a mobile UI change without a phone.
---

# /shots: check mobile UI without a phone

Runs `npm run shots` (from `capitals-app/`), which opens the app in an iPhone 14 sized Chrome and saves one PNG per named screen.

## Screen IDs (stable, so the user can say "shot 03")
- `01-landing` world map
- `02-drill-map-africa` continent map with Start + gear
- `03-settings-drawer` Vaul settings drawer
- `04-find-quiz-africa` find the country: top bar, insets, controls
- `05-find-quiz-zoomed` find the country after zooming
- `06-capital-quiz-keyboard` name the capital in a keyboard-sized viewport
- `07-results` results with map

## Workflow
1. Before changing UI, capture the "before": `npm run shots -- --baseline` (skip if `shots/baseline/` already reflects the current code).
2. Make the change.
3. Run `npm run shots`.
4. Read the PNGs in `shots/latest/` and show the relevant before/after pairs to the user by ID. Point out overlaps, text that wraps or overflows, controls covering islands, and anything not touch-sized (44px).
5. `shots/latest/index.html` is a side-by-side contact sheet; mention it so the user can open it.

## Notes
- Uses the installed Google Chrome (falls back to Playwright's Chromium).
- `shots/` is gitignored; only the 5 newest timestamped runs are kept.
- Mobile only. Do not change desktop layout while checking mobile.
