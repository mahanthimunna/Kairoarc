# Mahanthi Kannapalli — Portfolio ("The Systems Mind")

Self-contained static site. No build step.

## Files
- index.html + 9 project/system pages
- style.css (shared), systems.js (shared engine)
- images/ (all assets)

## Preview locally
Open index.html in a browser. Fonts (Clash Display, Satoshi, JetBrains Mono) and
boxicons load from CDNs — connect to the internet to see them; offline falls back gracefully.

## Deploy to GitHub Pages
Copy everything into your repo root (keep the images/ folder), commit, push.

## Highlights
- Loading effect = the "A Connected Craft" skill network wiring itself up.
    • index: the FULL network connects itself.
    • each project page: only that project's related nodes light up & connect
      (same trace as hovering a node). Controlled by data-loader-focus on <body>.
- The A Connected Craft section keeps its interactive hover-to-trace effect.
- Brand logo: [MK] monogram + wordmark. Navbar assembles on load.
- Fully responsive; thedeadlyscriptmurdercase.html still needs its YouTube embed.
