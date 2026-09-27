(() => {
  "use strict";

  const MIX = "mix";
  const STAGGER_MS = 600;
  const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const rupees = (n) => "₹" + inr.format(n);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = {
    data: null,         // profiles.json
    moments: [],        // moments.json .moments
    profileIndex: 0,
    personaId: MIX,
    expandedId: null,
    roasts: {},         // profileId -> roasts json | null (failed)
    renderToken: 0,
  };
  const cache = new Map();
  const $ = (id) => document.getElementById(id);
  let autoOpenTimer = 0;

  function getJSON(url) {
    if (!cache.has(url)) {
      const p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(url + " returned " + r.status);
        return r.json();
      });
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    return cache.get(url);
  }

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };

  const profile = () => state.data.profiles[state.profileIndex];
  const personaById = (id) => state.data.personas.find((p) => p.id === id);
  const momentsFor = (profileId) => state.moments.filter((m) => m.profile === profileId);

  // Resolve a moment to { moment, persona, roast, fix } for the current voice.
  function resolve(m) {
    const pid = state.personaId === MIX ? m.persona : state.personaId;
    const list = (state.roasts[m.profile] || {})[pid] || [];
    const idx = m.roasts && Number.isInteger(m.roasts[pid]) ? m.roasts[pid] : 0;
    const r = list[idx] || list[0];
    return r ? { moment: m, persona: personaById(pid), roast: r.roast, fix: r.fix } : null;
  }

  function currentItems() {
    return momentsFor(profile().id).map(resolve).filter(Boolean);
  }

  // The expanded notification, or the first one.
  function activeItem() {
    const items = currentItems();
    return items.find((it) => it.moment.id === state.expandedId) || items[0] || null;
  }

  // ---------- Rendering ----------
  function renderPersonas() {
    const all = [{ id: MIX, name: "Mix", brief: "A different voice for each notification" }, ...state.data.personas];
    $("personas").replaceChildren(...all.map((p) => {
      const b = el("button", { type: "button", class: "chip", "aria-pressed": String(p.id === state.personaId), "data-id": p.id, title: p.brief, text: p.name });
      b.addEventListener("click", () => selectPersona(p.id));
      return b;
    }));
  }

  function syncPressed() {
    for (const b of $("personas").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.id === state.personaId));
  }

  function renderCaption() {
    const p = profile();
    const parts = [p.name, rupees(p.totalSpent) + " spent", p.percentOfSalary + "% of salary"];
    $("caption").replaceChildren(...parts.flatMap((t, i) => (i ? [" · ", el("span", { text: t })] : [el("span", { text: t })])));
  }

  function notifNode(it) {
    const m = it.moment;
    const fixText = String(it.fix).replace(/^\s*Fix:\s*/i, "");
    const open = m.id === state.expandedId;
    const bodyId = "nb-" + m.id;
    const btn = el("button", {
      type: "button", class: "notif", "aria-expanded": String(open), "aria-controls": bodyId, "data-id": m.id,
    },
      el("span", { class: "n-head" },
        el("span", { class: "n-tile", "aria-hidden": "true", text: "F" }),
        el("span", { class: "n-app", text: "Fold" }),
        el("span", { class: "n-time", text: m.time })),
      el("span", { class: "n-title", text: m.title }),
      el("span", { class: "n-body", id: bodyId }, it.roast),
      el("span", { class: "n-more" },
        el("span", { class: "n-fix" }, el("span", { class: "n-fix-label", text: "Fix" }), fixText),
        el("span", { class: "n-voice", text: (it.persona ? it.persona.name : "") + " · " + m.trigger })));
    btn.addEventListener("click", () => toggle(m.id));
    return el("li", {}, btn);
  }

  function renderNotifs(animate) {
    clearTimeout(autoOpenTimer);
    const box = $("notifs");
    const p = profile();
    const roasts = state.roasts[p.id];
    if (roasts === null) {
      box.replaceChildren(el("li", {}, el("div", { class: "notif", text: "Couldn't load this spender. Try Next spender or refresh." })));
      setButtons(false);
      return;
    }
    const items = currentItems();
    if (!items.length) {
      box.replaceChildren();
      setButtons(false);
      return;
    }
    const motion = animate && !reducedMotion.matches;
    const nodes = items.map((it, i) => {
      const li = notifNode(it);
      if (motion) {
        li.classList.add("enter");
        li.style.animationDelay = (i * STAGGER_MS) + "ms";
      }
      return li;
    });
    box.replaceChildren(...nodes);
    box.scrollTop = 0;
    setButtons(true);

    const voice = state.personaId === MIX ? "mixed voices" : personaById(state.personaId).name;
    $("sr-status").textContent = items.length + " notifications for " + p.name + ", " + voice + ".";

    // Open the first one once they've all arrived, so a full roast is readable without a tap.
    if (animate && state.expandedId === null) {
      const delay = motion ? (items.length - 1) * STAGGER_MS + 700 : 0;
      const token = state.renderToken;
      autoOpenTimer = setTimeout(() => {
        if (token === state.renderToken && state.expandedId === null) setExpanded(items[0].moment.id);
      }, delay);
    }
  }

  function setExpanded(id) {
    state.expandedId = id;
    for (const b of $("notifs").querySelectorAll(".notif[data-id]")) {
      b.setAttribute("aria-expanded", String(b.dataset.id === id));
    }
  }

  function toggle(id) {
    clearTimeout(autoOpenTimer);
    setExpanded(state.expandedId === id ? "" : id); // "" = user closed all; don't auto-open again
  }

  function setButtons(on) {
    for (const id of ["btn-share", "btn-save"]) $(id).disabled = !on;
  }

  // ---------- Actions ----------
  async function loadRoasts(id) {
    if (state.roasts[id]) return;
    try {
      state.roasts[id] = await getJSON("data/roasts/" + encodeURIComponent(id) + ".json");
    } catch (e) {
      console.error(e);
      state.roasts[id] = null;
    }
  }

  async function showProfile(index) {
    state.profileIndex = index;
    state.expandedId = null;
    const token = ++state.renderToken;
    renderCaption();
    const id = profile().id;
    if (state.roasts[id] === undefined) {
      $("notifs").replaceChildren();
      await loadRoasts(id);
    }
    if (token !== state.renderToken) return;
    renderNotifs(true);
  }

  function nextSpender() {
    showProfile((state.profileIndex + 1) % state.data.profiles.length);
  }

  function selectPersona(id) {
    if (id === state.personaId) return;
    state.personaId = id;
    state.expandedId = null;
    state.renderToken++;
    syncPressed();
    renderNotifs(true);
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function shareText(it) {
    return it.moment.title + "\n" + it.roast + "\n" + it.fix + "\n\n— " + (it.persona ? it.persona.name + ", " : "") + "Fold Unfiltered (a concept, fictional data)";
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = el("textarea", { readonly: "", "aria-hidden": "true" });
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  async function share() {
    const it = activeItem();
    if (!it) return;
    const text = shareText(it);
    const url = location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: "Fold Unfiltered", text, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    toast((await copy(text + "\n" + url)) ? "Roast copied to clipboard" : "Couldn't copy. Select the text instead.");
  }

  // ---------- Canvas image ----------
  function wrap(ctx, text, maxWidth) {
    const lines = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width <= maxWidth || !line) line = test;
        else { lines.push(line); line = word; }
      }
      lines.push(line);
    }
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function renderImage() {
    const it = activeItem();
    if (!it) return null;
    const W = 1080, H = 1350;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const sans = '-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    // Wallpaper (light lock-screen palette, same in both themes so the image is consistent)
    const g = ctx.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, "#f3a88c"); g.addColorStop(0.48, "#c79ad8"); g.addColorStop(1, "#6d86d8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const glow = (x, y, r, col) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col); rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    };
    glow(160, 60, 700, "rgba(255,214,196,0.75)");
    glow(W, 760, 620, "rgba(214,176,232,0.55)");

    // Lock screen time
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "600 40px " + sans;
    ctx.fillText("Saturday, 27 September", W / 2, 150);
    ctx.font = "700 220px " + sans;
    ctx.fillText("9:41", W / 2, 350);
    ctx.textAlign = "left";

    // Notification card, text sized to fit
    const CX = 72, CW = W - CX * 2, P = 48, TW = CW - P * 2;
    const fixText = String(it.fix).replace(/^\s*Fix:\s*/i, "");
    let s = 1, L;
    for (; s >= 0.7; s -= 0.05) {
      ctx.font = "400 " + Math.round(44 * s) + "px " + sans;
      const body = wrap(ctx, it.roast, TW);
      ctx.font = "500 " + Math.round(38 * s) + "px " + sans;
      const fixLabelW = ctx.measureText("FIX  ").width;
      const fix = wrap(ctx, fixText, TW - 56 - fixLabelW);
      ctx.font = "700 " + Math.round(46 * s) + "px " + sans;
      const title = wrap(ctx, it.moment.title, TW);
      L = { title, body, fix, fixLabelW };
      const h = cardHeight(L, s);
      if (h <= H - 450 - 140) break;
    }
    s = Math.max(s, 0.7);
    const CH = cardHeight(L, s);
    const CY = Math.max(430, 430 + (H - 140 - 430 - CH) / 2 - 40);

    ctx.save();
    ctx.shadowColor = "rgba(40,20,60,0.25)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    roundRect(ctx, CX, CY, CW, CH, 56);
    ctx.fillStyle = "rgba(250,248,245,0.88)"; ctx.fill();
    ctx.restore();
    roundRect(ctx, CX, CY, CW, CH, 56);
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.stroke();

    let y = CY + P;
    // header: tile, app, time
    const tile = 60;
    roundRect(ctx, CX + P, y, tile, tile, 16);
    ctx.fillStyle = "#2d2b29"; ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "750 38px " + sans; ctx.textAlign = "center";
    ctx.fillText("F", CX + P + tile / 2, y + 44);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(20,20,20,0.56)"; ctx.font = "600 32px " + sans;
    ctx.fillText("FOLD", CX + P + tile + 22, y + 42);
    ctx.textAlign = "right"; ctx.font = "400 32px " + sans;
    ctx.fillText(it.moment.time, CX + CW - P, y + 42);
    ctx.textAlign = "left";
    y += tile + 34;

    const lh = (px) => px * 1.3;
    const tSize = Math.round(46 * s), bSize = Math.round(44 * s), fSize = Math.round(38 * s);
    ctx.fillStyle = "#141414"; ctx.font = "700 " + tSize + "px " + sans;
    for (const line of L.title) { y += lh(tSize); ctx.fillText(line, CX + P, y - tSize * 0.28); }
    y += 10;
    ctx.font = "400 " + bSize + "px " + sans;
    for (const line of L.body) { y += lh(bSize); ctx.fillText(line, CX + P, y - bSize * 0.28); }

    // Fix block
    y += 30;
    const fixH = L.fix.length * lh(fSize) + 48;
    roundRect(ctx, CX + P, y, TW, fixH, 28);
    ctx.fillStyle = "rgba(20,20,20,0.06)"; ctx.fill();
    let fy = y + 24;
    ctx.font = "800 " + Math.round(fSize * 0.78) + "px " + sans;
    ctx.fillStyle = "#0f5132";
    ctx.fillText("FIX", CX + P + 28, fy + lh(fSize) - fSize * 0.3);
    ctx.fillStyle = "#141414"; ctx.font = "500 " + fSize + "px " + sans;
    for (const line of L.fix) { fy += lh(fSize); ctx.fillText(line, CX + P + 28 + L.fixLabelW, fy - fSize * 0.28); }
    y += fixH + 30;

    ctx.fillStyle = "rgba(20,20,20,0.56)"; ctx.font = "400 30px " + sans;
    ctx.fillText((it.persona ? it.persona.name : "") + " · " + profile().name, CX + P, y + 26);

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.font = "600 30px " + sans; ctx.textAlign = "center";
    ctx.fillText("Fold Unfiltered · concept", W / 2, H - 70);
    ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "400 24px " + sans;
    ctx.fillText("Fictional data", W / 2, H - 34);
    ctx.textAlign = "left";
    return c;

    function cardHeight(L, s) {
      const lh = (px) => px * 1.3;
      return 48 + 60 + 34 + L.title.length * lh(46 * s) + 10 + L.body.length * lh(44 * s)
        + 30 + (L.fix.length * lh(38 * s) + 48) + 30 + 36 + 48;
    }
  }

  function saveImage() {
    const c = renderImage();
    if (!c) return;
    const it = activeItem();
    const voice = it.persona ? it.persona.id : "mix";
    const name = "fold-unfiltered-" + it.moment.id + "-" + voice + ".png";
    c.toBlob((blob) => {
      if (!blob) { toast("Couldn't create the image"); return; }
      const url = URL.createObjectURL(blob);
      const a = el("a", { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast("Image saved");
    }, "image/png");
  }

  // ---------- Boot ----------
  async function init() {
    $("btn-next").addEventListener("click", nextSpender);
    $("btn-share").addEventListener("click", share);
    $("btn-save").addEventListener("click", saveImage);
    setButtons(false);
    try {
      const [data, moments] = await Promise.all([getJSON("data/profiles.json"), getJSON("data/moments.json")]);
      state.data = data;
      state.moments = Array.isArray(moments.moments) ? moments.moments : [];
    } catch (e) {
      console.error(e);
      $("notifs").replaceChildren(el("li", {}, el("div", { class: "notif", text: "Couldn't load the demo. Refresh to try again." })));
      $("btn-next").disabled = true;
      return;
    }
    renderPersonas();
    await showProfile(0);
    // Warm the cache for the other spenders so switching is instant.
    for (const p of state.data.profiles.slice(1)) {
      getJSON("data/roasts/" + encodeURIComponent(p.id) + ".json").then((r) => { state.roasts[p.id] = r; }).catch(() => {});
    }
  }

  init();
})();
