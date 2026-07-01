# Mahanthi Kannapalli — Portfolio ("The Systems Mind")

A complete, self-contained static site. No build step, no dependencies to install.

## What's inside
- `index.html` — the main page (hero node-graph, capabilities band, projects, systems, contact)
- 9 project/system pages (echos-of-lie, combatfusion, side-scroller, private-room,
  thedeadlyscriptmurdercase, dynamicattackrate, prims-maze, camera-visibility-scoring, l-system-trees)
- `style.css` — all styling (shared by every page)
- `systems.js` — the shared interaction engine (constellation background, energy-portal
  loader, scroll effects, 3D tilt, return-vault back console, capability meters)
- `images/` — all 159 image assets

## How to preview locally
Just open `index.html` in a browser. Because `style.css`, `systems.js`, and `images/`
sit next to it, everything loads and renders (dark theme + 3D effects).

Fonts (Space Grotesk, JetBrains Mono) and icons (boxicons) load from CDNs, so a live
internet connection makes them appear; offline, the layout still works with fallback fonts.

## How to deploy to GitHub Pages (mahanthimunna.github.io)
1. Copy ALL of these files into your repo root (replace the old ones), keeping the
   `images/` folder exactly as named.
2. Commit and push.
3. Your site updates at your GitHub Pages URL.

## Notes
- `thedeadlyscriptmurdercase.html` still has a placeholder YouTube embed
  (`YOUR_YOUTUBE_EMBED_LINK_HERE`). Replace it with your real embed link when ready.
- All original content (projects, systems, the Dynamic Attack Rate formulas, tags,
  bio, links) is preserved. The redesign is additive.
- Press `Esc` on any project page to return to the relevant vault (a keyboard shortcut
  built into the new back console).
