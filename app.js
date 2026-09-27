(() => {
  "use strict";

  const DEFAULT_PERSONA = "savage-friend";
  const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const rupees = (n) => "₹" + inr.format(n);

  const state = { data: null, profileId: null, personaId: DEFAULT_PERSONA, index: 0, roasts: {} };
  const cache = new Map();
  const $ = (id) => document.getElementById(id);

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

  const profile = () => state.data.profiles.find((p) => p.id === state.profileId);
  const persona = () => state.data.personas.find((p) => p.id === state.personaId);
  const currentRoast = () => {
    const list = (state.roasts[state.profileId] || {})[state.personaId] || [];
    return list.length ? list[state.index % list.length] : null;
  };

  // ---------- Rendering ----------
  function renderSpenders() {
    const box = $("spenders");
    box.replaceChildren(...state.data.profiles.map((p) => {
      const b = el("button", { type: "button", class: "spender", "aria-pressed": String(p.id === state.profileId), "data-id": p.id },
        el("span", { class: "s-name", text: p.name }),
        el("span", { class: "s-tag", text: p.tagline }));
      b.addEventListener("click", () => selectProfile(p.id));
      return b;
    }));
  }

  function renderPersonas() {
    const box = $("personas");
    box.replaceChildren(...state.data.personas.map((p) => {
      const b = el("button", { type: "button", class: "chip", "aria-pressed": String(p.id === state.personaId), "data-id": p.id, title: p.brief, text: p.name });
      b.addEventListener("click", () => selectPersona(p.id));
      return b;
    }));
  }

  function syncPressed(boxId, activeId) {
    for (const b of $(boxId).querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.id === activeId));
  }

  function renderMonth() {
    const p = profile();
    const maxCat = Math.max(...p.categories.map((c) => c.total));
    const stats = el("div", { class: "stats" },
      el("div", { class: "stat" },
        el("p", { class: "stat-label", text: "Total spent" }),
        el("p", { class: "stat-value", text: rupees(p.totalSpent) }),
        el("p", { class: "stat-sub", text: p.txnCount + " payments" })),
      el("div", { class: "stat" },
        el("p", { class: "stat-label", text: "Of salary" }),
        el("p", { class: "stat-value", text: p.percentOfSalary + "%" }),
        el("p", { class: "stat-sub", text: "Salary " + rupees(p.salary) })));

    const cats = el("ul", { class: "cats", "aria-label": "Top categories" },
      ...p.categories.map((c) => {
        const bar = el("span");
        bar.style.width = Math.max(4, Math.round((c.total / maxCat) * 100)) + "%";
        return el("li", { class: "cat" },
          el("div", { class: "cat-row" },
            el("span", { class: "cat-label" }, c.label + " ", el("span", { class: "cat-count", text: "· " + c.count + (c.count === 1 ? " payment" : " payments") })),
            el("span", { class: "cat-total", text: rupees(c.total) })),
          el("div", { class: "cat-bar", "aria-hidden": "true" }, bar),
          el("div", { class: "cat-merchants", text: c.merchants.map(([m, a]) => m + " " + rupees(a)).join(" · ") }));
      }));

    const pats = el("ul", { class: "patterns", "aria-label": "Patterns" },
      ...p.patterns.map((pt) => el("li", { text: pt.amount && !pt.text.includes("₹") ? pt.text + " (" + rupees(pt.amount) + ")" : pt.text })));

    $("month").replaceChildren(stats, cats, pats);
  }

  function renderRoast(animate) {
    const card = $("roast");
    const r = currentRoast();
    const per = persona();
    $("roast-persona").textContent = per ? per.name : "";
    if (!r) {
      $("roast-text").textContent = state.roasts[state.profileId] === null ? "Couldn't load roasts for this spender. Try again in a bit." : "Loading…";
      $("roast-fix").textContent = "";
      $("roast-meta").textContent = "";
    } else {
      $("roast-text").textContent = r.roast;
      $("roast-fix").textContent = r.fix;
      const total = state.roasts[state.profileId][state.personaId].length;
      $("roast-meta").textContent = "Roasting " + profile().name + " · " + ((state.index % total) + 1) + " of " + total;
    }
    for (const id of ["btn-next", "btn-share", "btn-save"]) $(id).disabled = !r;
    if (animate) {
      card.classList.remove("swap");
      void card.offsetWidth;
      card.classList.add("swap");
    }
  }

  // ---------- Actions ----------
  async function loadRoasts(id) {
    try {
      state.roasts[id] = await getJSON("data/roasts/" + encodeURIComponent(id) + ".json");
    } catch (e) {
      console.error(e);
      state.roasts[id] = null;
    }
  }

  async function selectProfile(id) {
    state.profileId = id;
    state.index = 0;
    syncPressed("spenders", id);
    renderMonth();
    renderRoast(false);
    if (!state.roasts[id]) await loadRoasts(id);
    if (state.profileId === id) renderRoast(true);
  }

  function selectPersona(id) {
    state.personaId = id;
    state.index = 0;
    syncPressed("personas", id);
    renderRoast(true);
  }

  function next() {
    state.index += 1;
    renderRoast(true);
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function shareText() {
    const r = currentRoast();
    return r.roast + "\n" + r.fix + "\n\n— " + persona().name + ", roasting " + profile().name + " on Paisa Dost";
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
    if (!currentRoast()) return;
    const text = shareText();
    const url = location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: "Paisa Dost", text, url });
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

  function fitLines(ctx, text, font, sizes, maxWidth, maxHeight, lh) {
    for (const size of sizes) {
      ctx.font = font(size);
      const lines = wrap(ctx, text, maxWidth);
      if (lines.length * size * lh <= maxHeight) return { size, lines };
    }
    const size = sizes[sizes.length - 1];
    ctx.font = font(size);
    return { size, lines: wrap(ctx, text, maxWidth) };
  }

  function renderImage() {
    const r = currentRoast();
    if (!r) return null;
    const W = 1080, H = 1350, M = 96, CW = W - M * 2;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const serif = getComputedStyle(document.documentElement).getPropertyValue("--serif").trim() || "Georgia, serif";
    const sans = getComputedStyle(document.documentElement).getPropertyValue("--sans").trim() || "system-ui, sans-serif";
    const C = { bg: "#171412", ink: "#f7f2ea", muted: "#b9ae9f", accent: "#fb923c", rule: "rgba(247,242,234,0.2)" };

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.accent;
    ctx.fillRect(0, 0, W, 16);

    ctx.textBaseline = "alphabetic";
    // big quote mark
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = C.accent;
    ctx.font = "700 360px " + serif;
    ctx.fillText("“", W - 300, 330);
    ctx.globalAlpha = 1;

    // persona
    ctx.fillStyle = C.accent;
    ctx.font = "700 34px " + sans;
    let y = 190;
    ctx.fillText(persona().name.toUpperCase(), M, y);

    // roast
    y += 80;
    const roastBox = fitLines(ctx, r.roast, (s) => "600 " + s + "px " + serif, [72, 66, 60, 56, 52, 48, 44], CW, 580, 1.28);
    ctx.fillStyle = C.ink;
    ctx.font = "600 " + roastBox.size + "px " + serif;
    for (const line of roastBox.lines) { y += roastBox.size * 1.28; ctx.fillText(line, M, y - roastBox.size * 0.28); }

    // rule + fix
    y += 44;
    ctx.fillStyle = C.rule;
    ctx.fillRect(M, y, CW, 2);
    y += 20;
    const fixBox = fitLines(ctx, r.fix, (s) => "500 " + s + "px " + sans, [38, 34, 30], CW, 180, 1.4);
    ctx.fillStyle = C.ink;
    ctx.font = "500 " + fixBox.size + "px " + sans;
    for (const line of fixBox.lines) { y += fixBox.size * 1.4; ctx.fillText(line, M, y - fixBox.size * 0.4); }

    // footer
    ctx.fillStyle = C.muted;
    ctx.font = "500 30px " + sans;
    ctx.fillText("Roasting: " + profile().name, M, H - 150);
    ctx.fillStyle = C.ink;
    ctx.font = "700 46px " + serif;
    ctx.fillText("Paisa Dost", M, H - 88);
    ctx.fillStyle = C.muted;
    ctx.font = "500 24px " + sans;
    ctx.textAlign = "right";
    ctx.fillText("Fictional data · concept", W - M, H - 92);
    ctx.textAlign = "left";
    return c;
  }

  function saveImage() {
    const c = renderImage();
    if (!c) return;
    const name = "paisa-dost-" + state.profileId + "-" + state.personaId + ".png";
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
    $("btn-next").addEventListener("click", next);
    $("btn-share").addEventListener("click", share);
    $("btn-save").addEventListener("click", saveImage);
    try {
      state.data = await getJSON("data/profiles.json");
    } catch (e) {
      console.error(e);
      $("roast-text").textContent = "Couldn't load the demo data. Refresh to try again.";
      return;
    }
    if (!state.data.personas.some((p) => p.id === state.personaId)) state.personaId = state.data.personas[0].id;
    state.profileId = state.data.profiles[0].id;
    renderSpenders();
    renderPersonas();
    await selectProfile(state.profileId);
    // Warm the cache for the other spenders so switching is instant.
    for (const p of state.data.profiles.slice(1)) getJSON("data/roasts/" + encodeURIComponent(p.id) + ".json").catch(() => {});
  }

  init();
})();
