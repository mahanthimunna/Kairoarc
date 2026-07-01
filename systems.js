/* =========================================================================
   THE SYSTEMS MIND  —  shared interaction engine
   Pure vanilla JS, no dependencies (keeps GitHub Pages load light).
   Powers: 3D depth starfield, hero node-graph, scroll-reveal, 3D card tilt,
   scroll HUD + section rail, navbar state, parallax grid, hero typing.
   Everything is rAF-throttled, pauses offscreen, and respects reduced-motion.
   ========================================================================= */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------------------------------------------------------------
     0)  Scaffold — inject the shared background + HUD layers once
  --------------------------------------------------------------------- */
  function el(tag, props, parent) {
    const n = document.createElement(tag);
    if (props) Object.assign(n, props);
    if (parent) parent.appendChild(n);
    return n;
  }

  // Depth field (starfield canvas lives here)
  let depthField = document.getElementById("depth-field");
  if (!depthField) {
    depthField = el("div", { id: "depth-field" });
    document.body.insertBefore(depthField, document.body.firstChild);
  }
  const depthCanvas = el("canvas", null, depthField);

  // Blueprint grid overlay
  if (!document.getElementById("grid-overlay")) {
    const g = el("div", { id: "grid-overlay" });
    document.body.insertBefore(g, depthField.nextSibling);
  }
  const gridOverlay = document.getElementById("grid-overlay");

  // Scroll HUD (top progress rail)
  let hud = document.getElementById("scroll-hud");
  if (!hud) {
    hud = el("div", { id: "scroll-hud" });
    el("div", { className: "bar" }, hud);
    document.body.appendChild(hud);
  }
  const hudBar = hud.querySelector(".bar");


  /* ---------------------------------------------------------------------
     0b)  CONNECT-THE-DOTS LOADER  (themed per page)
     The load animation IS the constellation forming: nodes fade in, then
     links "trace" between them one-by-one (the effect from A Connected
     Craft). Home connects the FULL network; each project connects its own
     themed cluster. Then it dissolves into the live page.
  --------------------------------------------------------------------- */
  (function buildConnectLoader() {
    const oldLoader = document.getElementById("loader");
    const theme = document.body.getAttribute("data-loader") || "home";

    // per-theme node labels + accent. Home = full discipline network.
    const THEMES = {
      home:        { title: "MAHANTHI KANNAPALLI", tag: "Initializing the system",
                     labels: ["GAMEPLAY","SYSTEMS","MATH","AI","PROCEDURAL","COMBAT","PHYSICS","TOOLS","NARRATIVE","RENDER","UI/UX","ENGINE"], accent: "125,235,255" },
      combat:      { title: "COMBAT SYSTEMS", tag: "Loading combat module",
                     labels: ["ATTACK","DAMAGE","TIMING","COMBO","AI","FINISHER","LOCK-ON","FEEDBACK"], accent: "125,235,255" },
      horror:      { title: "HORROR SYSTEMS", tag: "Loading atmosphere",
                     labels: ["SANITY","AI","STEALTH","LIGHT","SOUND","STATE","FEAR","TRIGGER"], accent: "150,130,255" },
      procedural:  { title: "PROCEDURAL GEN", tag: "Generating structure",
                     labels: ["SEED","GRAPH","RULES","GROWTH","BRANCH","NODES","EXPAND","OUTPUT"], accent: "125,235,255" },
      traversal:   { title: "TRAVERSAL", tag: "Loading movement",
                     labels: ["JUMP","DASH","CLIMB","MOMENTUM","INPUT","ANIM","PHYSICS","FLOW"], accent: "125,235,255" },
      environment: { title: "ENVIRONMENT ART", tag: "Building the space",
                     labels: ["ASSET","LIGHT","MOOD","PROP","LAYOUT","TEXTURE","SPACE","DETAIL"], accent: "125,235,255" },
      narrative:   { title: "NARRATIVE SYSTEMS", tag: "Loading the story",
                     labels: ["DIALOGUE","BRANCH","STATE","CHOICE","UI","FLAG","SCENE","BEAT"], accent: "150,130,255" },
      evaluation:  { title: "EVALUATION", tag: "Calibrating",
                     labels: ["CAPTURE","TARGET","SCORE","VISIBLE","OCCLUDE","FRAME","METRIC","OUTPUT"], accent: "125,235,255" }
    };
    const T = THEMES[theme] || THEMES.home;

    if (!document.getElementById("loader-style")) {
      const css = document.createElement("style");
      css.id = "loader-style";
      css.textContent = `
        #loader{background:radial-gradient(circle at 50% 45%,#070d1a 0%,#03050d 60%,#010206 100%)!important;
          display:flex!important;align-items:center;justify-content:center;}
        #loader .load-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
        #loader .load-brand{position:absolute;left:50%;bottom:14%;transform:translateX(-50%);
          text-align:center;pointer-events:none;opacity:0;animation:brandIn .9s ease .5s forwards;width:90%;}
        #loader .load-name{font-family:var(--font-display,sans-serif);font-weight:600;
          font-size:clamp(1.3rem,4.5vw,2.4rem);letter-spacing:.08em;
          color:#eaf6ff;text-shadow:0 0 30px rgba(125,225,255,.5);}
        #loader .load-tag{margin-top:.6rem;font-family:var(--font-mono,monospace);
          font-size:clamp(.58rem,1.6vw,.72rem);letter-spacing:.4em;text-transform:uppercase;
          color:rgb(${T.accent});opacity:.85;}
        #loader .load-tag .lb{display:inline-block;width:8px;animation:loadBlink 1s steps(1) infinite;}
        @keyframes brandIn{from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        @keyframes loadBlink{0%,100%{opacity:1}50%{opacity:0}}
        #loader.fade-out{opacity:0;visibility:hidden;transition:opacity .8s ease,visibility .8s ease;}
        @media (prefers-reduced-motion: reduce){#loader .load-brand{animation:none;opacity:1;}}
      `;
      document.head.appendChild(css);
    }

    let loader;
    if (oldLoader) { loader = oldLoader.cloneNode(false); oldLoader.parentNode.replaceChild(loader, oldLoader); }
    else { loader = document.createElement("div"); loader.id = "loader"; document.body.insertBefore(loader, document.body.firstChild); }
    loader.innerHTML =
      '<canvas class="load-canvas"></canvas>' +
      '<div class="load-brand">' +
        '<div class="load-name">' + T.title + '</div>' +
        '<div class="load-tag">' + T.tag + '<span class="lb">_</span></div>' +
      '</div>';

    const lc = loader.querySelector(".load-canvas");
    const lx = lc.getContext("2d");
    let lw, lh, ldpr, lraf;
    const pts = [], edges = [];
    const start = performance.now();
    // how many extra "field" dots beyond the labeled nodes
    const isHome = theme === "home";

    function build() {
      ldpr = Math.min(window.devicePixelRatio || 1, 2);
      lw = window.innerWidth; lh = window.innerHeight;
      lc.width = lw * ldpr; lc.height = lh * ldpr;
      lx.setTransform(ldpr, 0, 0, ldpr, 0, 0);

      pts.length = 0; edges.length = 0;
      const cx = lw / 2, cy = lh * 0.42;
      const R = Math.min(lw, lh) * (isHome ? 0.30 : 0.24);

      // labeled nodes arranged on a ring (+ a couple inner for home)
      const labels = T.labels;
      labels.forEach((lb, i) => {
        const ang = (i / labels.length) * TAU - Math.PI / 2;
        const rr = R * (isHome && i % 3 === 0 ? 0.55 : 1) * (0.85 + Math.random() * 0.3);
        pts.push({
          x: cx + Math.cos(ang) * rr * (lw > lh ? 1.5 : 1.05),
          y: cy + Math.sin(ang) * rr,
          r: 3.2, label: lb, appear: 0.15 + (i / labels.length) * 0.5,
          vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15
        });
      });
      // extra ambient field dots (more on home)
      const extra = isHome ? 46 : 22;
      for (let i = 0; i < extra; i++) {
        pts.push({
          x: Math.random() * lw, y: Math.random() * lh, r: Math.random() * 1.3 + 0.6,
          label: null, appear: Math.random() * 0.5,
          vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25
        });
      }
      // precompute edges: connect near neighbours, staggered draw times
      const LINK = Math.min(lw, lh) * (isHome ? 0.34 : 0.4);
      let order = 0;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            edges.push({ a: i, b: j, drawAt: 0.4 + Math.min(order * 0.012, 1.4), d });
            order++;
          }
        }
      }
    }
    build();

    function draw() {
      const t = (performance.now() - start) / 1000; // seconds elapsed
      lx.clearRect(0, 0, lw, lh);

      // drift
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > lw) p.vx *= -1;
        if (p.y < 0 || p.y > lh) p.vy *= -1;
      }

      // edges "trace" in progressively
      for (const e of edges) {
        if (t < e.drawAt) continue;
        const prog = clamp((t - e.drawAt) / 0.5, 0, 1); // 0..1 line growth
        const A = pts[e.a], B = pts[e.b];
        const ex = lerp(A.x, B.x, prog), ey = lerp(A.y, B.y, prog);
        lx.strokeStyle = "rgba(" + T.accent + "," + (0.28 * prog).toFixed(3) + ")";
        lx.lineWidth = 1;
        lx.beginPath(); lx.moveTo(A.x, A.y); lx.lineTo(ex, ey); lx.stroke();
        // a bright head while the line is drawing
        if (prog < 1) {
          lx.beginPath(); lx.arc(ex, ey, 2, 0, TAU);
          lx.fillStyle = "rgba(200,245,255,0.95)";
          lx.shadowBlur = 8; lx.shadowColor = "rgba(" + T.accent + ",0.9)";
          lx.fill(); lx.shadowBlur = 0;
        }
      }

      // nodes pop in at their appear time
      for (const p of pts) {
        if (t < p.appear) continue;
        const pop = clamp((t - p.appear) / 0.4, 0, 1);
        const rr = p.r * (0.5 + pop * 0.5);
        // halo
        lx.beginPath(); lx.arc(p.x, p.y, rr * 2.4, 0, TAU);
        lx.fillStyle = "rgba(" + T.accent + "," + (0.10 * pop).toFixed(3) + ")"; lx.fill();
        // core
        lx.beginPath(); lx.arc(p.x, p.y, rr, 0, TAU);
        lx.fillStyle = "rgba(" + (p.label ? "220,245,255" : T.accent) + "," + pop.toFixed(2) + ")"; lx.fill();
        if (p.label) {
          lx.lineWidth = 1; lx.strokeStyle = "rgba(255,255,255," + (0.5 * pop) + ")"; lx.stroke();
          if (lw > 620 || isHome) {
            lx.font = "600 10px 'JetBrains Mono', monospace";
            lx.textAlign = "center";
            lx.fillStyle = "rgba(200,225,255," + (0.85 * pop) + ")";
            lx.fillText(p.label, p.x, p.y - rr - 8);
          }
        }
      }
      lraf = requestAnimationFrame(draw);
    }
    if (!reduceMotion) draw();
    window.addEventListener("resize", build);

    // dissolve into the page once the network has formed
    const HOLD = reduceMotion ? 300 : 2400;
    setTimeout(() => {
      document.body.classList.add("page-ready");
      loader.classList.add("fade-out");
      const nav = document.querySelector(".navbar");
      if (nav) nav.classList.add("nav-armed");
      document.body.classList.add("nav-armed");
      setTimeout(() => { cancelAnimationFrame(lraf); }, 900);
    }, HOLD);
  })();


  /* ---------------------------------------------------------------------
     1)  PARTICLE CONSTELLATION  (the ambient background)
     Drifting points connected by lines that brighten as they near each
     other; the cursor gently pulls nearby points and lights their links.
     Reads as a living "systems graph" behind the whole site.
  --------------------------------------------------------------------- */
  const dctx = depthCanvas.getContext("2d");
  let dW = 0, dH = 0, dDPR = 1;
  let pts = [];
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, px: -9999, py: -9999 };

  // density scales with screen area but is capped for performance
  function particleCount() {
    const base = (window.innerWidth * window.innerHeight) / 9000;
    const cap = window.innerWidth < 700 ? 60 : 200;
    return Math.round(clamp(base, 40, cap));
  }
  const LINK_DIST = () => (window.innerWidth < 700 ? 130 : 175);

  function seedParticles() {
    pts = [];
    if (reduceMotion) return;
    const n = particleCount();
    for (let i = 0; i < n; i++) {
      pts.push({
        x: Math.random() * dW,
        y: Math.random() * dH,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.4 + 0.7,
        // a few accent-violet points among mostly cyan
        v: Math.random() < 0.18,
        tw: Math.random() * TAU,
      });
    }
  }

  function sizeDepth() {
    dDPR = Math.min(window.devicePixelRatio || 1, 2);
    dW = window.innerWidth;
    dH = window.innerHeight;
    depthCanvas.width = dW * dDPR;
    depthCanvas.height = dH * dDPR;
    dctx.setTransform(dDPR, 0, 0, dDPR, 0, 0);
    seedParticles();
  }

  function drawDepth() {
    dctx.clearRect(0, 0, dW, dH);
    if (reduceMotion) return;

    mouse.x = lerp(mouse.x, mouse.tx, 0.06);
    mouse.y = lerp(mouse.y, mouse.ty, 0.06);
    const mx = mouse.px, my = mouse.py;
    const maxLink = LINK_DIST();
    const maxLink2 = maxLink * maxLink;
    const REPEL = 150, REPEL2 = REPEL * REPEL;

    // update + draw points
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x += p.vx; p.y += p.vy;

      // wrap softly around edges
      if (p.x < -20) p.x = dW + 20; else if (p.x > dW + 20) p.x = -20;
      if (p.y < -20) p.y = dH + 20; else if (p.y > dH + 20) p.y = -20;

      // cursor influence: gentle pull + slight swirl
      if (mx > -9000) {
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if (d2 < REPEL2 && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / REPEL) * 0.6;
          p.x -= (dx / d) * f;
          p.y -= (dy / d) * f;
        }
      }

      p.tw += 0.015;
      const tw = 0.6 + 0.4 * Math.sin(p.tw);
      const color = p.v ? "150,130,255" : "125,225,255";

      dctx.beginPath();
      dctx.arc(p.x, p.y, p.r, 0, TAU);
      dctx.fillStyle = "rgba(" + color + "," + (0.55 * tw).toFixed(3) + ")";
      dctx.fill();
    }

    // draw links (n^2 but n is capped) — brighter as points get closer
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < maxLink2) {
          const t = 1 - d2 / maxLink2;        // 0..1 closeness
          let alpha = t * 0.18;
          // boost links near the cursor so it "lights up" the web
          if (mx > -9000) {
            const cmx = (a.x + b.x) * 0.5 - mx;
            const cmy = (a.y + b.y) * 0.5 - my;
            if (cmx * cmx + cmy * cmy < REPEL2) alpha += t * 0.25;
          }
          dctx.strokeStyle = "rgba(125,225,255," + alpha.toFixed(3) + ")";
          dctx.lineWidth = 1;
          dctx.beginPath();
          dctx.moveTo(a.x, a.y);
          dctx.lineTo(b.x, b.y);
          dctx.stroke();
        }
      }
    }

    // soft glow halo following the cursor
    if (mx > -9000) {
      const g = dctx.createRadialGradient(mx, my, 0, mx, my, 200);
      g.addColorStop(0, "rgba(47,143,255,0.08)");
      g.addColorStop(1, "rgba(47,143,255,0)");
      dctx.fillStyle = g;
      dctx.fillRect(mx - 200, my - 200, 400, 400);
    }
  }

  // track the real cursor position for constellation interaction
  window.addEventListener("pointermove", (e) => {
    mouse.px = e.clientX; mouse.py = e.clientY;
  });
  window.addEventListener("pointerleave", () => { mouse.px = -9999; mouse.py = -9999; });


  /* ---------------------------------------------------------------------
     3)  MASTER ANIMATION LOOP (single rAF for everything canvas)
  --------------------------------------------------------------------- */
  let running = true;
  function frame() {
    if (running) {
      drawDepth();
    }
    requestAnimationFrame(frame);
  }
  // pause when tab hidden (saves battery)
  document.addEventListener("visibilitychange", () => { running = !document.hidden; });

  /* ---------------------------------------------------------------------
     4)  GLOBAL POINTER → drives starfield parallax + portrait 3D tilt
  --------------------------------------------------------------------- */
  const portraitBox = document.querySelector(".home-img .img-box");
  window.addEventListener("pointermove", (e) => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = e.clientY / window.innerHeight;

    if (portraitBox && !isCoarse && !reduceMotion) {
      const r = portraitBox.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clamp((e.clientX - cx) / (r.width / 2), -1, 1);
      const dy = clamp((e.clientY - cy) / (r.height / 2), -1, 1);
      portraitBox.style.transform =
        "rotateY(" + (dx * 8).toFixed(2) + "deg) rotateX(" + (-dy * 8).toFixed(2) + "deg)";
    }
  });
  if (portraitBox && !isCoarse) {
    portraitBox.addEventListener("pointerleave", () => {
      portraitBox.style.transform = "rotateY(0deg) rotateX(0deg)";
    });
  }

  /* ---------------------------------------------------------------------
     5)  3D CARD TILT  (project + system cards)
  --------------------------------------------------------------------- */
  function bindTilt(card) {
    // glare layer is added on all pointers; tilt itself only on fine pointers
    if (!card.querySelector(".glare")) {
      const g = document.createElement("span");
      g.className = "glare";
      card.appendChild(g);
    }
    if (isCoarse || reduceMotion) return;
    const MAX = 9;
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const dx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      const dy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
      card.style.transform =
        "translateY(-10px) rotateY(" + (dx * MAX).toFixed(2) + "deg) rotateX(" +
        (-dy * MAX).toFixed(2) + "deg) scale(1.012)";
      // glare via CSS var
      card.style.setProperty("--mx", ((dx + 1) * 50).toFixed(1) + "%");
      card.style.setProperty("--my", ((dy + 1) * 50).toFixed(1) + "%");
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  }
  document.querySelectorAll(".project-card, .system-card").forEach(bindTilt);

  /* ---------------------------------------------------------------------
     6)  SCROLL-REVEAL  (IntersectionObserver, staggered)
  --------------------------------------------------------------------- */
  function tagReveals() {
    const sel = [
      ".games-title", ".games-subtitle", ".filter-bar", ".filter-count",
      ".project-link", ".systems-title", ".systems-subtitle",
      ".system-card", ".contact-title", ".contact-subtitle",
      ".contact-email", ".contact-socials", ".contact-footer",
      // project pages
      ".project-hero-overlay", ".project-video-section", ".accordion-item",
      ".project-content > section", ".back-link",
    ];
    document.querySelectorAll(sel.join(",")).forEach((node) => {
      if (node.closest(".navbar")) return;
      if (node.closest(".home")) return;   // hero already has its own intro animation
      node.classList.add("reveal");
    });
    // section eyebrows that are NOT in the hero
    document.querySelectorAll(".sys-eyebrow").forEach((node) => {
      if (node.closest(".home") || node.closest(".project-hero")) return;
      node.classList.add("reveal");
    });
  }
  tagReveals();

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  // apply small stagger to grouped items
  function staggerGroup(items) {
    items.forEach((n, i) => n.style.setProperty("--reveal-delay", (i % 6) * 70 + "ms"));
  }
  staggerGroup(Array.from(document.querySelectorAll(".projects-grid .project-link")));
  staggerGroup(Array.from(document.querySelectorAll(".systems-grid .system-card, .systems-grid .project-link")));
  staggerGroup(Array.from(document.querySelectorAll(".accordion-item")));

  document.querySelectorAll(".reveal").forEach((n) => io.observe(n));

  /* ---------------------------------------------------------------------
     7)  SCROLL HUD + NAVBAR STATE + GRID PARALLAX + SECTION RAIL
  --------------------------------------------------------------------- */
  const navbar = document.querySelector(".navbar");
  const sectionRail = document.getElementById("section-rail");
  const railLinks = sectionRail ? Array.from(sectionRail.querySelectorAll("a")) : [];
  const sections = railLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const st = window.scrollY || document.documentElement.scrollTop;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const p = docH > 0 ? clamp(st / docH, 0, 1) : 0;
      hudBar.style.setProperty("--p", (p * 100).toFixed(2) + "%");

      if (navbar) navbar.classList.toggle("scrolled", st > 40);

      // (constellation background handles its own motion; grid glow drifts via CSS)

      // active section dot
      if (sections.length) {
        let idx = 0;
        for (let i = 0; i < sections.length; i++) {
          if (sections[i].getBoundingClientRect().top <= window.innerHeight * 0.4) idx = i;
        }
        railLinks.forEach((a, i) => a.classList.toggle("active", i === idx));
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------------
     8)  HERO STATUS TYPING  (mono "boot" line, loops subtly)
  --------------------------------------------------------------------- */
  const statusEl = document.querySelector(".hero-status[data-lines]");
  if (statusEl && !reduceMotion) {
    let lines;
    try { lines = JSON.parse(statusEl.getAttribute("data-lines")); }
    catch (e) { lines = ["SYSTEM ONLINE"]; }
    let li = 0, ci = 0, deleting = false;
    const caret = '<span class="blink">▋</span>';
    function tick() {
      const full = lines[li];
      if (!deleting) {
        ci++;
        statusEl.innerHTML = full.slice(0, ci) + caret;
        if (ci >= full.length) { deleting = true; return setTimeout(tick, 2200); }
        setTimeout(tick, 45 + Math.random() * 40);
      } else {
        ci--;
        statusEl.innerHTML = full.slice(0, ci) + caret;
        if (ci <= 0) { deleting = false; li = (li + 1) % lines.length; return setTimeout(tick, 350); }
        setTimeout(tick, 22);
      }
    }
    tick();
  } else if (statusEl) {
    try { statusEl.textContent = JSON.parse(statusEl.getAttribute("data-lines"))[0]; } catch (e) {}
  }

  /* ---------------------------------------------------------------------
     9)  PROJECT FILTER  (index only)
  --------------------------------------------------------------------- */
  const filterBar = document.querySelector(".filter-bar");
  if (filterBar) {
    const chips = Array.from(filterBar.querySelectorAll(".filter-chip"));
    const cards = Array.from(document.querySelectorAll(".projects-grid .project-link"));
    const countEl = document.querySelector(".filter-count");
    function applyFilter(key) {
      let shown = 0;
      cards.forEach((c) => {
        const tags = (c.getAttribute("data-tags") || "").toLowerCase();
        const match = key === "all" || tags.includes(key);
        c.classList.toggle("filtered-out", !match);
        if (match) {
          shown++;
          c.classList.remove("filtering");
          void c.offsetWidth; // reflow to restart animation
          c.classList.add("filtering");
        }
      });
      if (countEl) countEl.textContent =
        "// showing " + shown + " of " + cards.length + " modules";
    }
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        applyFilter((chip.getAttribute("data-filter") || "all").toLowerCase());
      });
    });
    if (countEl) countEl.textContent = "// showing " + cards.length + " of " + cards.length + " modules";
  }

  /* ---------------------------------------------------------------------
     9b)  SKILL CONSTELLATION  (interactive capability map)
     Reads #skillmap-data JSON, lays out nodes on a canvas, draws links,
     and on hover highlights a node + its connections and updates a readout.
     No scores, no fixed boundary — an open, explorable system.
  --------------------------------------------------------------------- */
  (function skillMap() {
    const host = document.getElementById("skillmap");
    if (!host) return;
    const canvas = host.querySelector(".skillmap-canvas");
    const ctx = canvas.getContext("2d");
    const dataEl = document.getElementById("skillmap-data");
    let data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

    const readout = host.querySelector(".skillmap-readout");
    const rLabel = readout.querySelector(".smr-label");
    const rTitle = readout.querySelector(".smr-title");
    const rDesc  = readout.querySelector(".smr-desc");

    let W, H, DPR, nodes = [], active = null, hoverId = null;
    const idIndex = {};

    function layout() {
      const rect = host.getBoundingClientRect();
      W = rect.width; H = rect.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const cores = data.nodes.filter(n => n.group === "core");
      const branches = data.nodes.filter(n => n.group !== "core");
      nodes = [];
      idIndex.length = 0;

      const cx = W / 2, cy = H / 2;
      const small = Math.min(W, H);
      // cores clustered near center in a small triangle
      cores.forEach((n, i) => {
        const a = (i / cores.length) * TAU - Math.PI / 2;
        const r = small * 0.11;
        nodes.push(makeNode(n, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 9));
      });
      // branches on an outer ring
      branches.forEach((n, i) => {
        const a = (i / branches.length) * TAU - Math.PI / 2 + 0.35;
        const r = small * (W > H ? 0.32 : 0.30);
        const rx = r * (W > H ? 1.35 : 1.0);
        nodes.push(makeNode(n, cx + Math.cos(a) * rx, cy + Math.sin(a) * r, 6));
      });
      nodes.forEach((n, i) => { idIndex[n.id] = i; });
    }
    function makeNode(def, x, y, r) {
      return { ...def, x, y, bx: x, by: y, r, pulse: Math.random() * TAU,
               vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2 };
    }

    function linkedSet(id) {
      const s = new Set([id]);
      const n = nodes[idIndex[id]];
      if (n && n.links) n.links.forEach(l => s.add(l));
      // also include nodes that link TO this one
      nodes.forEach(o => { if (o.links && o.links.includes(id)) s.add(o.id); });
      return s;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const focus = hoverId || active;
      const lit = focus ? linkedSet(focus) : null;

      // links
      for (const n of nodes) {
        if (!n.links) continue;
        for (const lid of n.links) {
          const t = nodes[idIndex[lid]];
          if (!t) continue;
          const isLit = lit && lit.has(n.id) && lit.has(lid);
          const dimmed = lit && !isLit;
          ctx.strokeStyle = isLit
            ? "rgba(125,235,255,0.55)"
            : dimmed ? "rgba(125,200,255,0.05)" : "rgba(125,200,255,0.14)";
          ctx.lineWidth = isLit ? 1.6 : 1;
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(t.x, t.y); ctx.stroke();

          // travelling pulse on lit links
          if (isLit && !reduceMotion) {
            const tt = (performance.now() / 1400 + (idIndex[lid] * 0.13)) % 1;
            const px = lerp(n.x, t.x, tt), py = lerp(n.y, t.y, tt);
            ctx.beginPath(); ctx.arc(px, py, 2.4, 0, TAU);
            ctx.fillStyle = "rgba(180,245,255,0.95)";
            ctx.shadowBlur = 10; ctx.shadowColor = "rgba(125,235,255,0.9)";
            ctx.fill(); ctx.shadowBlur = 0;
          }
        }
      }

      // nodes
      for (const n of nodes) {
        if (!reduceMotion) n.pulse += 0.03;
        const glow = 0.5 + 0.5 * Math.sin(n.pulse);
        const isCore = n.group === "core";
        const dimmed = lit && !lit.has(n.id);
        const isFocus = focus === n.id;

        const baseCol = isCore ? "190,240,255" : "125,225,255";
        const alpha = dimmed ? 0.28 : 1;

        // halo
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (isFocus ? 4 : 2.3 + glow * 0.6), 0, TAU);
        ctx.fillStyle = "rgba(" + baseCol + "," + ((isFocus ? 0.16 : 0.06) * alpha).toFixed(3) + ")";
        ctx.fill();

        // core dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (isFocus ? 1.35 : 1), 0, TAU);
        ctx.fillStyle = "rgba(" + baseCol + "," + alpha.toFixed(2) + ")";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,255,255," + (0.55 * alpha).toFixed(2) + ")";
        ctx.stroke();

        // label
        const showLabel = isCore || W > 640 || isFocus;
        if (showLabel) {
          ctx.font = (isCore ? "600 " : "500 ") + (isCore ? 13 : 11) + "px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(" + (dimmed ? "120,135,165," + 0.4 : "220,238,255," + alpha) + ")";
          ctx.fillText(n.label, n.x, n.y - n.r - 10);
        }
      }
    }

    function pick(mx, my) {
      let hit = null, best = 26 * 26;
      for (const n of nodes) {
        const dx = n.x - mx, dy = n.y - my, d2 = dx * dx + dy * dy;
        const rr = (n.r + 16) * (n.r + 16);
        if (d2 < rr && d2 < best) { best = d2; hit = n; }
      }
      return hit;
    }

    function setReadout(n) {
      if (!n) {
        rLabel.textContent = "SELECT A NODE";
        rTitle.textContent = "Explore the craft";
        rDesc.textContent = "Move across the map to see how each discipline links to the rest.";
        host.classList.remove("has-focus");
        return;
      }
      rLabel.textContent = (n.group === "core" ? "CORE DISCIPLINE" : "SPECIALIZATION");
      rTitle.textContent = n.label;
      rDesc.textContent = n.desc;
      host.classList.add("has-focus");
    }

    host.addEventListener("pointermove", (e) => {
      const rect = host.getBoundingClientRect();
      const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
      hoverId = hit ? hit.id : null;
      host.style.cursor = hit ? "pointer" : "default";
      setReadout(hit || (active ? nodes[idIndex[active]] : null));
    });
    host.addEventListener("pointerleave", () => {
      hoverId = null;
      setReadout(active ? nodes[idIndex[active]] : null);
    });
    // tap to lock a node (mobile-friendly)
    host.addEventListener("click", (e) => {
      const rect = host.getBoundingClientRect();
      const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
      active = hit ? hit.id : null;
      setReadout(hit || null);
    });

    let raf;
    function loop() { draw(); raf = requestAnimationFrame(loop); }
    layout();
    setReadout(null);
    loop();

    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf); else loop();
    });
  })();

  /* ---------------------------------------------------------------------
     10)  INIT + RESIZE
  --------------------------------------------------------------------- */
  function sizeAll() { sizeDepth(); }
  sizeDepth();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { sizeAll(); }, 180);
  });
  requestAnimationFrame(frame);
})();
