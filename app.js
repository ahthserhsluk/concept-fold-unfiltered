(() => {
  "use strict";

  const MIX = "mix";
  const STAGGER_MS = 600;
  const FIT_LEVELS = 2; // body-font shrink steps before the list scrolls inside the phone
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

  // Resolve a moment to { moment, roast, fix } for the current voice.
  function resolve(m) {
    const pid = state.personaId === MIX ? m.persona : state.personaId;
    const list = (state.roasts[m.profile] || {})[pid] || [];
    const idx = m.roasts && Number.isInteger(m.roasts[pid]) ? m.roasts[pid] : 0;
    const r = list[idx] || list[0];
    return r ? { moment: m, roast: r.roast, fix: r.fix } : null;
  }

  // ---------- Rendering ----------
  function renderVoices() {
    const sel = $("voice");
    sel.replaceChildren(
      el("option", { value: MIX, text: "Mix" }),
      ...state.data.personas.map((p) => el("option", { value: p.id, text: p.name })));
    sel.value = state.personaId;
  }

  function renderSwitcher() {
    const p = profile();
    $("sw-name").textContent = p.name;
    $("sw-sub").textContent = rupees(p.totalSpent) + " spent · " + p.percentOfSalary + "% of salary";
  }

  function notifNode(it) {
    const m = it.moment;
    const fixText = String(it.fix).replace(/^\s*Fix:\s*/i, "");
    const bodyId = "nb-" + m.id;
    const btn = el("button", {
      type: "button", class: "notif", "aria-expanded": "false", "aria-controls": bodyId, "data-id": m.id,
    },
      el("span", { class: "n-head" },
        el("span", { class: "n-tile", "aria-hidden": "true", text: "F" }),
        el("span", { class: "n-app", text: "Fold" }),
        el("span", { class: "n-time", text: m.time })),
      el("span", { class: "n-title", text: m.title }),
      el("span", { class: "n-body", id: bodyId }, it.roast),
      el("span", { class: "n-fix" }, el("span", { class: "n-fix-label", text: "Fix" }), fixText));
    btn.addEventListener("click", () => toggle(m.id));
    return el("li", {}, btn);
  }

  function renderNotifs(animate) {
    const box = $("notifs");
    const p = profile();
    if (state.roasts[p.id] === null) {
      box.replaceChildren(el("li", {}, el("div", { class: "notif", text: "Couldn't load this spender. Try the next one or refresh." })));
      fit();
      return;
    }
    const items = momentsFor(p.id).map(resolve).filter(Boolean);
    const motion = animate && !reducedMotion.matches;
    box.replaceChildren(...items.map((it, i) => {
      const li = notifNode(it);
      if (motion) {
        li.classList.add("enter");
        li.style.animationDelay = (i * STAGGER_MS) + "ms";
      }
      return li;
    }));
    fit();

    const voice = state.personaId === MIX ? "mixed voices" : personaById(state.personaId).name;
    $("sr-status").textContent = items.length + " notifications for " + p.name + ", " + voice + ".";
  }

  function toggle(id) {
    state.expandedId = state.expandedId === id ? null : id;
    for (const b of $("notifs").querySelectorAll(".notif[data-id]")) {
      b.setAttribute("aria-expanded", String(b.dataset.id === state.expandedId));
    }
    fit();
  }

  // Keep everything inside the phone screen: shrink the open roast a little,
  // and only as a last resort let the notification list scroll inside the phone.
  function fit() {
    const box = $("notifs");
    const open = state.expandedId !== null;
    box.closest(".screen").classList.toggle("has-open", open);
    box.classList.remove("scroll");
    box.dataset.fit = "0";
    const over = () => box.scrollHeight > box.clientHeight + 1;
    for (let lvl = 1; open && lvl <= FIT_LEVELS && over(); lvl++) box.dataset.fit = String(lvl);
    if (over()) {
      box.classList.add("scroll");
      const b = open && box.querySelector('.notif[aria-expanded="true"]');
      box.scrollTop = b ? b.parentElement.offsetTop - box.offsetTop - 8 : 0;
    } else {
      box.scrollTop = 0;
    }
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
    const n = state.data.profiles.length;
    state.profileIndex = (index + n) % n;
    state.expandedId = null;
    const token = ++state.renderToken;
    renderSwitcher();
    const id = profile().id;
    if (!state.roasts[id]) {
      $("notifs").replaceChildren();
      await loadRoasts(id);
    }
    if (token !== state.renderToken) return;
    renderNotifs(true);
  }

  function selectPersona(id) {
    if (id === state.personaId) return;
    state.personaId = id;
    state.expandedId = null;
    state.renderToken++;
    renderNotifs(true);
  }

  // ---------- Boot ----------
  async function init() {
    for (const id of ["prev", "next", "voice"]) $(id).disabled = true;
    try {
      const [data, moments] = await Promise.all([getJSON("data/profiles.json"), getJSON("data/moments.json")]);
      state.data = data;
      state.moments = Array.isArray(moments.moments) ? moments.moments : [];
    } catch (e) {
      console.error(e);
      $("notifs").replaceChildren(el("li", {}, el("div", { class: "notif", text: "Couldn't load the demo. Refresh to try again." })));
      return;
    }
    renderVoices();
    $("prev").addEventListener("click", () => showProfile(state.profileIndex - 1));
    $("next").addEventListener("click", () => showProfile(state.profileIndex + 1));
    $("voice").addEventListener("change", (e) => selectPersona(e.target.value));
    for (const id of ["prev", "next", "voice"]) $(id).disabled = false;

    let raf = 0;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });

    await showProfile(0);
    // Warm the cache for the other spenders so switching is instant.
    for (const p of state.data.profiles.slice(1)) {
      getJSON("data/roasts/" + encodeURIComponent(p.id) + ".json").then((r) => { state.roasts[p.id] = r; }).catch(() => {});
    }
  }

  init();
})();

// "Why Fold" bottom sheet on phones (inline block on desktop)
(() => {
  const btn = document.querySelector('.why-btn');
  const sheet = document.getElementById('why');
  const scrim = document.querySelector('.scrim');
  const close = document.querySelector('.why-close');
  if (!btn || !sheet) return;
  const set = (open) => {
    sheet.classList.toggle('open', open);
    scrim.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) close.focus(); else btn.focus();
  };
  btn.addEventListener('click', () => set(true));
  close.addEventListener('click', () => set(false));
  scrim.addEventListener('click', () => set(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) set(false); });
})();
