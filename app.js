"use strict";

/* ------------------------------------------------------------------ *
 *  Building Jerusillion — a daily rare-answer quiz for St Paul's College.
 *  Your score is your altitude: rarer answers fly your balloon higher.
 *  Prompts live in puzzles.txt; the pixel world is drawn in scene.js.
 * ------------------------------------------------------------------ */

const CONFIG = {
  name: "Building Jerusillion",
  tagline: "The rarer your answer, the higher you climb.",
  timeZone: "Australia/Sydney", // the puzzle rolls over at midnight here
  secondsPerQuestion: 20,
  puzzleFile: "puzzles.txt",
};

// Points double as metres climbed.
const TIERS = {
  0: { name: "Grounded", points: 0, emoji: "❌",
       blurb: ["Time's up. The balloon stays put.", "The clock beat you to it. No lift."] },
  1: { name: "Wine Glass", points: 10, emoji: "🍷",
       blurb: ["Half the college said that.", "As common as a glass at Formal.", "Safe. Very, very safe."] },
  2: { name: "Rings", points: 25, emoji: "💍",
       blurb: ["Respectable. Not remarkable.", "A step off the beaten path."] },
  3: { name: "Piano", points: 50, emoji: "🎹",
       blurb: ["Now we're playing.", "Solid. The crowd didn't get there."] },
  4: { name: "Chalice", points: 75, emoji: "🏆",
       blurb: ["Few Paulines would've found that.", "That's a proper find."] },
  5: { name: "Crossed Swords", points: 100, emoji: "⚔️",
       blurb: ["Nobody saw that coming.", "Unreal. Put it on the honour board."] },
};

// Words that can start a tier line in puzzles.txt (after lower-casing and dropping apostrophes).
// The old Paul's Gold words still work.
const TIER_WORDS = {
  "wine": 1, "wine glass": 1, "glass": 1, "1": 1, "fools gold": 1, "fools": 1, "fool": 1, "common": 1,
  "rings": 2, "ring": 2, "2": 2, "bronze": 2,
  "piano": 3, "3": 3, "silver": 3,
  "chalice": 4, "4": 4, "gold": 4,
  "swords": 5, "sword": 5, "crossed swords": 5, "5": 5, "mother lode": 5, "motherlode": 5, "lode": 5,
};

// The layers of the climb, by altitude on the 0–500 scale. A perfect day reaches Jerusalem.
const TOP = 500;
const BANDS = [
  [0, "St Paul's Lawn", "🌳"],
  [20, "College Rooftops", "🏫"],
  [60, "Above the Quad", "🏛️"],
  [110, "Harbour Views", "🌉"],
  [160, "Into the Clouds", "☁️"],
  [215, "Cloud Nine", "🌤️"],
  [265, "Golden Hour", "🌇"],
  [310, "Sunset", "🌅"],
  [360, "Twilight", "🌆"],
  [410, "Southern Cross", "✨"],
  [460, "The Heavens", "🌌"],
  [500, "Jerusalem", "🏰"],
].map(([min, name, emoji]) => ({ min, name, emoji }));

const PREFIX = "jerusillion:v1:";

const app = document.getElementById("app");
const toastEl = document.getElementById("toast");

let PUZZLES = [];   // [{ date, number, questions: [{ prompt, answers: [{ display, tier, keys }] }] }]
let WARNINGS = [];  // problems found in puzzles.txt, shown in preview mode
let MODE = "daily"; // daily | archive | preview
let puzzle = null;
let game = null;
let timerId = null;
let countdownId = null;

/* ---------------------------- storage ----------------------------- */

const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(PREFIX + key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

function saveGame() {
  if (MODE !== "preview") store.set("game:" + game.date, game);
}

/* ----------------------------- dates ------------------------------ */

function clockParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const o = {};
  for (const p of parts) o[p.type] = p.value;
  return o;
}

function todayKey() {
  const o = clockParts();
  return `${o.year}-${o.month}-${o.day}`;
}

function secondsToMidnight() {
  const o = clockParts();
  return 86400 - (+o.hour * 3600 + +o.minute * 60 + +o.second);
}

function fmtDate(key, short = false) {
  return new Date(key + "T12:00:00Z").toLocaleDateString("en-AU", short
    ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }
    : { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/* ---------------------------- parsing ----------------------------- */

function parsePuzzles(text) {
  const days = new Map();
  const warnings = [];
  let day = null;
  let q = null;

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const where = `Line ${i + 1}`;
    if (!line || line.startsWith("#")) return;

    const date = line.match(/^[=\-\s]*(\d{4}-\d{2}-\d{2})[=\-\s]*$/);
    if (date) {
      if (days.has(date[1])) warnings.push(`${where}: ${date[1]} appears twice — using the later one.`);
      day = { date: date[1], questions: [] };
      days.set(day.date, day);
      q = null;
      return;
    }

    const prompt = line.match(/^q\s*[:.)]\s*(.+)$/i);
    if (prompt) {
      if (!day) return warnings.push(`${where}: a question before any date — add a date line above it.`);
      q = { prompt: prompt[1].trim(), answers: [] };
      day.questions.push(q);
      return;
    }

    const tierLine = line.match(/^([^:]{1,20}):\s*(.*)$/);
    const tier = tierLine && TIER_WORDS[tierLine[1].toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ").trim()];
    if (tier) {
      if (!q) return warnings.push(`${where}: answers before any "Q:" line.`);
      addAnswers(q, tier, tierLine[2], where, warnings);
      return;
    }

    warnings.push(`${where}: didn't understand "${line.slice(0, 60)}"`);
  });

  const puzzles = [...days.values()]
    .filter((d) => {
      if (!d.questions.length) warnings.push(`${d.date} has no questions.`);
      d.questions.forEach((qq) => {
        if (!qq.answers.length) warnings.push(`${d.date}: "${qq.prompt}" has no answers yet.`);
      });
      return d.questions.length;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  puzzles.forEach((p, i) => { p.number = i + 1; });
  return { puzzles, warnings };
}

function addAnswers(q, tier, list, where, warnings) {
  for (const entry of list.split(",")) {
    const aliases = entry.split("/").map((s) => s.trim()).filter(Boolean);
    if (!aliases.length) continue;
    const forms = aliases.flatMap((a) => wordForms(a, q.prompt));
    const keys = new Set(forms.map((w) => w.join("")));
    const clash = q.answers.find((a) => [...keys].some((k) => [...a.keys].some((e) => sameKey(k, e))));
    if (clash) {
      warnings.push(`${where}: "${aliases[0]}" is already listed as ${TIERS[clash.tier].name} for "${q.prompt}".`);
      continue;
    }
    q.answers.push({ display: aliases[0], tier, keys, forms });
  }
}

/* ---------------------------- matching ---------------------------- */

function norm(s) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[&+]/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bmount\b/g, "mt")
    .replace(/\bn\b/g, "and")
    .replace(/\bintl\b/g, "international")
    .trim()
    .replace(/^(the|a|an) /, "")
    .replace(/^(bachelors?|masters?|doctor|degree) (of|in) /, "");
}

const PROMPT_SKIP = new Set(["name", "the", "and", "that", "with", "from", "you", "your", "something", "thing", "type", "kind", "one", "who", "can"]);

// "Bondi Beach" for "Name a Sydney beach" should match "Bondi": as well as the
// words as typed, also try them without a trailing word that's already in the prompt.
function wordForms(text, prompt) {
  const words = norm(text).split(" ").filter(Boolean);
  if (!words.length) return [];
  const out = [words];
  const promptWords = new Set(norm(prompt).split(" ").filter((w) => w.length > 2 && !PROMPT_SKIP.has(w)));
  if (words.length > 1 && promptWords.has(words[words.length - 1])) out.push(words.slice(0, -1));
  return out;
}

// Equal, or equal apart from a plural "s"/"es".
function sameKey(a, b) {
  return a === b || a === b + "s" || b === a + "s" || a === b + "es" || b === a + "es";
}

// Edits to turn a into b, where swapping two neighbouring letters counts as one.
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Typos forgiven for something this many letters long.
function slack(n) {
  return n >= 12 ? 3 : n >= 8 ? 2 : n >= 4 ? 1 : 0;
}

// Does one typed word fit one word of an answer? Returns { cost, short } or null:
// cost 0 for the same word, 1 for a shortening ("vet", "mech", "maths") or a typo,
// a bit more for a misspelt shortening. short = it's an abbreviation.
function wordMatch(g, a) {
  if (sameKey(g, a)) return { cost: 0, short: false };
  const stem = g.length > 4 && g.endsWith("s") ? g.slice(0, -1) : g;
  if (g.length >= 3 && g.length < a.length && a.startsWith(g)) return { cost: 1, short: true };
  if (stem !== g && stem.length < a.length && a.startsWith(stem)) return { cost: 1, short: true };
  if (a.length >= 5 && Math.abs(g.length - a.length) <= slack(a.length) && editDistance(g, a) <= slack(a.length)) return { cost: 1, short: false };
  if (g.length >= 5 && g.length < a.length && editDistance(g, a.slice(0, g.length)) <= 1) return { cost: 1.5, short: true };
  return null;
}

const FILLER = new Set(["and", "of", "in", "the", "a", "to"]);
// Words a player can leave off the end: "Mechanical" for "Mechanical Engineering",
// "Dining" for "Dining Hall", "Johns" for "Johns Formal".
const GENERIC = new Set([
  "science", "sciences", "sci", "studies", "engineering", "eng",
  "hall", "room", "house", "day", "dinner", "week", "night", "formal", "party", "theme",
]);

// Fit typed words to an answer's words, in order, from the first. Returns a cost
// (0 = perfect, +1 per shortened, misspelt or missing word), or null if it doesn't fit.
// The guess may stop early after an abbreviation ("vet" for "Veterinary Medicine")
// or when all that's left is generic ("Data" for "Data Science"); open = stop anywhere.
function phraseCost(gw, aw, open = false) {
  let i = 0;
  let cost = 0;
  let lastShort = false;
  for (let j = 0; j < aw.length; j++) {
    if (i === gw.length) {
      const rest = aw.slice(j).filter((w) => !FILLER.has(w));
      return open || lastShort || rest.every((w) => GENERIC.has(w)) ? cost + rest.length : null;
    }
    const m = wordMatch(gw[i], aw[j]);
    if (m) {
      cost += m.cost;
      lastShort = m.short;
      i++;
    } else if (!FILLER.has(aw[j])) return null;
  }
  return i === gw.length ? cost : null;
}

function findAnswer(q, guess) {
  const gForms = wordForms(guess, q.prompt);
  if (!gForms.length) return null;
  const gKeys = gForms.map((w) => w.join(""));

  for (const a of q.answers) {
    for (const k of a.keys) {
      for (const g of gKeys) {
        if (sameKey(g, k)) return a;
      }
    }
  }

  // Otherwise take the closest fit: a typo in the whole answer, or a word-by-word
  // match with shortenings. On a tie the more common answer wins, so a vague
  // shortening never scores better than typing the answer out.
  let best = null;
  let bestCost = Infinity;
  const consider = (a, cost) => {
    if (cost < bestCost || (cost === bestCost && a.tier < best.tier)) {
      best = a;
      bestCost = cost;
    }
  };
  for (const a of q.answers) {
    for (const k of a.keys) {
      for (const g of gKeys) {
        const allow = slack(k.length);
        if (allow && Math.abs(k.length - g.length) <= allow) {
          const d = editDistance(g, k);
          if (d <= allow) consider(a, d);
        }
      }
    }
    for (const aw of a.forms) {
      for (const gw of gForms) {
        const c = phraseCost(gw, aw);
        if (c !== null) consider(a, c);
      }
    }
  }

  // Last resort: the start of exactly one answer, like "Surreal" for "Surreal Sounds".
  // "Fralley" or "Chicken" start several, so they still don't count.
  if (!best && gKeys[0].length >= 4) {
    const hits = q.answers.filter((a) => a.forms.some((aw) => gForms.some((gw) => phraseCost(gw, aw, true) !== null)));
    if (hits.length === 1) best = hits[0];
  }
  return best;
}

/* ----------------------------- helpers ---------------------------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let later = []; // timeouts that belong to the current screen

// view: "ground" (parked on the lawn, with the title), "play" or "summit" (the results).
function show(html, view = "ground", ed = "") {
  stopTimer();
  clearInterval(countdownId);
  later.forEach(clearTimeout);
  later = [];
  document.body.dataset.view = view;
  Pixel.setView(view);
  app.innerHTML = (view === "ground" ? `
    <header class="masthead">
      <a class="wordmark" href="./"><span>Building</span> <span>Jerusillion</span></a>
      ${ed ? `<p class="edition">${ed}</p>` : ""}
    </header>
    <div class="lawn-gap" aria-hidden="true"></div>` : "") + html;
  window.scrollTo(0, 0);
}

function after(ms, fn) {
  later.push(setTimeout(fn, ms));
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

function totalOf(g) {
  return g.results.reduce((s, r) => s + (r && r.points ? r.points : 0), 0);
}

function maxOf(p = puzzle) {
  return p.questions.length * TIERS[5].points;
}

// Score → altitude on the 0–500 scale, so a perfect day always reaches the top.
function altOf(score, p = puzzle) {
  const max = maxOf(p);
  return max ? (score / max) * TOP : 0;
}

function bandFor(alt) {
  return BANDS.filter((b) => alt >= b.min - 1e-9).pop();
}

// Where each answer so far left the balloon, for the icons hanging in the sky.
function trailTo(count) {
  let sum = 0;
  return game.results.slice(0, count).map((r) => {
    sum += r.points;
    return { a: altOf(sum), tier: r.tier };
  });
}

// Tick a number up alongside the climb.
function countUp(el, from, to, ms) {
  if (!el || from === to || !ms) return;
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  el.textContent = from;
  requestAnimationFrame(step);
}

function shareUrl() {
  return location.origin + location.pathname;
}

function pick(list, i) {
  return list[i % list.length];
}

/* ------------------------------ stats ----------------------------- */

function stats() {
  const today = todayKey();
  const past = PUZZLES.filter((p) => p.date <= today).map((p) => p.date).reverse();
  let played = 0;
  let best = 0;
  for (const d of past) {
    const g = store.get("game:" + d);
    if (g && g.phase === "done") {
      played++;
      best = Math.max(best, totalOf(g));
    }
  }
  // Streak = run of puzzles played on their own day, counting back from today (or the last one).
  let streak = 0;
  let i = 0;
  const todays = store.get("game:" + today);
  if (past[0] === today && !(todays && todays.phase === "done")) i = 1;
  for (; i < past.length; i++) {
    const g = store.get("game:" + past[i]);
    if (g && g.phase === "done" && g.mode === "daily") streak++;
    else break;
  }
  return { played, best, streak };
}

/* ----------------------------- pieces ----------------------------- */

// Notes for the title and results screens. Preview only gets one when puzzles.txt has problems.
function banner() {
  if (MODE === "preview" && WARNINGS.length) {
    return `
      <div class="banner">
        <strong>Preview</strong> puzzles.txt has some lines to fix:
        <ul class="warnings">${WARNINGS.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      </div>`;
  }
  if (MODE === "archive") {
    return `<div class="banner"><strong>Archive</strong> doesn't count toward your streak. <a href="./">Today's puzzle</a></div>`;
  }
  return "";
}

function edition() {
  return `No. ${puzzle.number} · ${fmtDate(puzzle.date, true)}${MODE === "preview" ? " · Preview" : ""}`;
}

// The strip along the top while you play: altitude, progress, and the crest home.
function hud() {
  const n = puzzle.questions.length;
  const total = totalOf(game);
  const pips = puzzle.questions.map((_, i) => {
    const r = game.results[i];
    if (i < game.index || (i === game.index && game.phase === "reveal")) {
      return `<li class="pip done" title="${esc(TIERS[r.tier].name)}">${Pixel.tier(r.tier, 1)}</li>`;
    }
    return `<li class="pip${i === game.index ? " now" : ""}"></li>`;
  }).join("");
  return `
    <header class="hud">
      <p class="gauge" aria-label="Altitude ${total} metres">
        <small>Altitude</small>
        <b><span class="alt-num">${total}</span>m</b>
        <em>${esc(bandFor(altOf(total)).name)}</em>
      </p>
      <div class="progress">
        <ol class="pips">${pips}</ol>
        <small>Prompt ${game.index + 1} of ${n}</small>
      </div>
      <a class="crest" href="./" aria-label="${esc(CONFIG.name)}">${Pixel.sprite("cross", 2)}</a>
    </header>`;
}

function statsStrip() {
  const s = stats();
  if (!s.played) return "";
  return `
    <p class="stats" aria-label="Your stats">
      <span><b>${s.played}</b> played</span>
      <span><b>${s.streak}</b> streak</span>
      <span><b>${s.best}m</b> best</span>
    </p>`;
}

function footer() {
  return `
    <footer class="foot">
      <a href="?archive">Past puzzles</a>
      <span class="dot">·</span>
      <span>Made for St Paul's College</span>
    </footer>`;
}

/* ----------------------------- screens ---------------------------- */

function renderIntro() {
  const n = puzzle.questions.length;
  const ladder = [5, 4, 3, 2, 1].map((t) => `
    <li class="rung lv${t}">
      ${Pixel.tier(t, 2)}
      <span class="rung-name">${TIERS[t].name}</span>
      <span class="rung-pts">+${TIERS[t].points}m</span>
    </li>`).join("");

  Pixel.setTrail([]);
  Pixel.climbTo(0, true);
  show(`
    ${banner()}
    <section class="dock">
      <button class="btn primary big" data-action="start">▲ Start climbing ▲</button>
      <p class="dock-sub">${n} prompts · ${CONFIG.secondsPerQuestion} seconds each · ${esc(CONFIG.tagline.toLowerCase())}</p>
      ${statsStrip()}
      <details class="howto">
        <summary>How to play</summary>
        <div class="sheet">
          <ol class="rules">
            <li>Each prompt is something like <i>“Name a cocktail.”</i> You've got ${CONFIG.secondsPerQuestion} seconds to type an answer.</li>
            <li>Every right answer lifts your balloon. Obvious ones barely clear the lawn; rare ones soar.</li>
            <li>Wrong guesses cost nothing. Your first answer that's on the list locks in.</li>
            <li>Rise past Sydney Uni, the clouds, the sunset and the stars. A perfect day reaches Jerusalem.</li>
          </ol>
          <ol class="ladder" aria-label="Metres by rarity">${ladder}</ol>
        </div>
      </details>
    </section>
    ${footer()}
  `, "ground", edition());
}

function renderQuestion() {
  const i = game.index;
  const q = puzzle.questions[i];
  const r = game.results[i];
  const n = puzzle.questions.length;

  Pixel.setTrail(trailTo(i));
  Pixel.climbTo(altOf(totalOf(game)), true);
  show(`
    ${hud()}
    <section class="card">
      <p class="label">Prompt ${i + 1} of ${n}</p>
      <h2 class="prompt">${esc(q.prompt)}</h2>
      <p class="hint">▲ rarer answers climb higher ▲</p>
    </section>
    <form class="answer-bar guess" autocomplete="off">
      <div class="bar-inner">
        <p class="feedback" aria-live="polite"></p>
        <ul class="tried" aria-label="Guesses not on the list">${r.tried.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <div class="bar-row">
          <div class="timer" role="timer" aria-label="Seconds left"><span class="timer-num">${CONFIG.secondsPerQuestion}</span></div>
          <input id="guess" name="guess" type="text" maxlength="60" placeholder="your answer…"
            aria-label="Your answer" autocomplete="off" autocorrect="off" autocapitalize="words"
            spellcheck="false" enterkeyhint="go">
          <button class="btn primary" type="submit">Climb</button>
        </div>
        <div class="timer-track"><div class="timer-fill"></div></div>
      </div>
    </form>
  `, "play");

  const input = document.getElementById("guess");
  input.focus({ preventScroll: true });
  startTimer();
}

// fresh = straight after answering, so the balloon climbs; false = reloaded onto this screen.
function renderReveal(fresh) {
  const i = game.index;
  const q = puzzle.questions[i];
  const r = game.results[i];
  const t = TIERS[r.tier];
  const n = puzzle.questions.length;
  const last = i === n - 1;
  const total = totalOf(game);
  const before = total - r.points;
  const band = bandFor(altOf(total));
  const newBand = fresh && band !== bandFor(altOf(before));

  const rarer = q.answers
    .filter((a) => a.tier > r.tier)
    .map((a) => [Math.random(), a]).sort((x, y) => x[0] - y[0]).map(([, a]) => a) // shuffle within each tier
    .sort((a, b) => b.tier - a.tier)
    .slice(0, 3);
  const typed = r.guess && norm(r.guess) !== norm(r.answer) ? `<span class="typed">you typed “${esc(r.guess)}”</span>` : "";

  Pixel.setTrail(trailTo(i + 1));
  const ms = fresh ? Pixel.climbTo(altOf(total)) : Pixel.climbTo(altOf(total), true);

  show(`
    ${hud()}
    <p class="recap">${esc(q.prompt)}</p>
    <section class="reveal tier-${r.tier}">
      <div class="medal">${Pixel.tier(r.tier, 3)}<div class="burst"></div></div>
      <p class="tier-name">${t.name}</p>
      ${r.tier ? `<p class="your-answer">“${esc(r.answer)}”</p>${typed}` : ""}
      <p class="points">+${r.points} m <span>· now ${total} m up</span></p>
      <p class="blurb">${pick(t.blurb, i)}</p>
      ${newBand ? `<p class="new-height" style="animation-delay:${Math.round(ms * 0.6)}ms">▲ New height · ${esc(band.name)}</p>` : ""}
      ${rarer.length
        ? `<p class="finds"><b>${r.tier ? "Rarer" : "Try"}</b> ${rarer.map((a) => `<span>${Pixel.tier(a.tier, 1)}${esc(a.display)}</span>`).join("")}</p>`
        : `<p class="finds none">Nothing rarer on the list. Top of the board.</p>`}
    </section>
    <div class="dock-bottom">
      <button class="btn primary" data-action="next">${last ? "▲ See how high you got ▲" : "▲ Next prompt ▲"}</button>
    </div>
  `, "play");

  if (fresh) {
    countUp(app.querySelector(".alt-num"), before, total, ms);
    if (!r.tier) Pixel.effect("rain");
    if (r.tier === 5) after(ms, () => Pixel.effect("sparkle"));
  }
  if (r.tier >= 4) burst(r.tier === 5 ? 28 : 16);
  app.querySelector("[data-action=next]").focus({ preventScroll: true });
}

function renderResults() {
  const n = puzzle.questions.length;
  const max = maxOf();
  const total = totalOf(game);
  const band = bandFor(altOf(total));
  const icons = game.results.map((r) => Pixel.tier(r.tier, 2)).join("");

  // one column per prompt, as tall as the climb it earned
  const chart = puzzle.questions.map((_, i) => {
    const r = game.results[i] || { tier: 0, points: 0 };
    return `<li class="tier-${r.tier}" style="--h:${r.points}">${Pixel.tier(r.tier, 2)}<span class="stem"></span><small>${i + 1}</small></li>`;
  }).join("");

  const rows = puzzle.questions.map((q, i) => {
    const r = game.results[i] || { tier: 0, points: 0 };
    const all = [5, 4, 3, 2, 1].map((t) => {
      const list = q.answers.filter((a) => a.tier === t);
      return list.length ? `<p><b>${Pixel.tier(t, 1)} ${TIERS[t].name}</b>${list.map((a) => esc(a.display)).join(", ")}</p>` : "";
    }).join("");
    return `
      <li class="row">
        <span class="row-num">${i + 1}</span>
        <div class="row-main">
          <p class="row-prompt">${esc(q.prompt)}</p>
          <p class="row-answer">${r.tier ? esc(r.answer) : `<span class="miss">No answer</span>`}</p>
          <details><summary>Every answer on the list</summary><div class="all">${all}</div></details>
        </div>
        <span class="row-score">${Pixel.tier(r.tier, 2)}<b>+${r.points}</b></span>
      </li>`;
  }).join("");

  Pixel.setTrail(trailTo(n));
  Pixel.climbTo(altOf(total), true);
  show(`
    ${banner()}
    <header class="summit">
      <p class="label">${MODE === "daily" ? "Today's climb" : "Your climb"} · No. ${puzzle.number}</p>
      <p class="total"><b>${total}</b><span>m</span></p>
      <p class="rank">${band.emoji} ${esc(band.name)}</p>
      <p class="to-go">${total >= max ? "You built Jerusalem. Perfect day." : `${max - total} m short of Jerusalem`}</p>
      <p class="medal-row" aria-label="Your answers">${icons}</p>
      ${MODE === "preview"
        ? `<button class="btn ghost block" data-action="replay">Play again</button>`
        : `<button class="btn primary block" data-action="share">Share your climb</button>
           <p class="note">Shares your height and icons only. No spoilers.</p>`}
    </header>
    <div class="sky-window" aria-hidden="true"><span>▼ Climb log</span></div>
    <section class="sheet results-sheet">
      <h3 class="label">Climb log <span>higher = rarer</span></h3>
      <ol class="chart" style="--n:${n}">${chart}</ol>
      ${MODE === "daily" ? `<p class="countdown">Next prompts in <time>--:--:--</time></p>` : ""}
      <h3 class="label">Every answer</h3>
      <ol class="board">${rows}</ol>
      ${statsStrip()}
      ${footer()}
    </section>
  `, "summit");

  if (MODE === "daily") startCountdown();
}

function renderArchive() {
  const today = todayKey();
  const past = PUZZLES.filter((p) => p.date <= today).reverse();
  const rows = past.map((p) => {
    const g = store.get("game:" + p.date);
    const href = p.date === today ? "./" : `?day=${p.date}`;
    const status = g && g.phase === "done"
      ? `<span class="arch-score">${totalOf(g)}<small>m</small></span>`
      : g && g.phase !== "intro" ? `<span class="arch-play">Resume</span>` : `<span class="arch-play">Play</span>`;
    return `
      <li><a href="${href}">
        <span class="arch-no">No. ${p.number}</span>
        <span class="arch-date">${fmtDate(p.date, true)}${p.date === today ? " · today" : ""}</span>
        ${status}
      </a></li>`;
  }).join("");

  show(`
    <section class="sheet">
      <h3 class="label">The archive</h3>
      ${past.length ? `<ol class="arch">${rows}</ol>` : `<p class="lede">No puzzles yet. Check back soon.</p>`}
      ${statsStrip()}
    </section>
    ${footer()}
  `);
}

function renderNoPuzzle(date) {
  const today = todayKey();
  const latest = PUZZLES.filter((p) => p.date < today).pop();
  show(`
    ${banner()}
    <section class="sheet">
      <h3 class="label">${fmtDate(date, true)}</h3>
      <p class="lede">${MODE === "preview" ? `There's no puzzle for ${fmtDate(date)} in puzzles.txt yet.` : "Today's prompts haven't been posted yet."}</p>
      <p class="sub">Check back soon${latest ? ", or have a crack at an old one." : "."}</p>
      ${latest ? `<a class="btn ghost block" href="?day=${latest.date}">Play No. ${latest.number}</a>` : ""}
    </section>
    ${footer()}
  `);
}

function renderError() {
  show(`
    <section class="sheet">
      <h3 class="label">Uh oh</h3>
      <p class="lede">Couldn't load today's prompts.</p>
      <p class="sub">Check your connection and refresh the page.</p>
      <button class="btn ghost block" data-action="reload">Try again</button>
    </section>
  `);
}

/* ------------------------------ timing ---------------------------- */

function startTimer() {
  const total = CONFIG.secondsPerQuestion * 1000;
  const fill = app.querySelector(".timer-fill");
  const num = app.querySelector(".timer-num");
  const wrap = app.querySelector(".timer");
  const update = () => {
    const left = Math.max(0, game.deadline - Date.now());
    fill.style.width = `${(left / total) * 100}%`;
    wrap.style.setProperty("--t", (Math.ceil(left / 1000) * 1000) / total);
    num.textContent = Math.ceil(left / 1000);
    wrap.classList.toggle("urgent", left <= 5000);
    if (left <= 0) timeUp();
  };
  update();
  timerId = setInterval(update, 100);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function startCountdown() {
  const el = app.querySelector(".countdown time");
  const update = () => {
    const s = secondsToMidnight();
    if (s <= 1) return location.reload();
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    el.textContent = `${hh}:${mm}:${ss}`;
  };
  update();
  countdownId = setInterval(update, 1000);
}

/* ----------------------------- actions ---------------------------- */

function newGame() {
  return { date: puzzle.date, mode: MODE, phase: "intro", index: 0, deadline: 0, results: [] };
}

function beginQuestion(i) {
  game.index = i;
  game.phase = "question";
  game.deadline = Date.now() + CONFIG.secondsPerQuestion * 1000;
  game.results[i] = { prompt: puzzle.questions[i].prompt, guess: "", answer: "", tier: 0, points: 0, tried: [] };
  saveGame();
  renderQuestion();
}

function submitGuess(raw) {
  if (game.phase !== "question") return;
  const guess = raw.trim();
  const input = document.getElementById("guess");
  const fb = app.querySelector(".feedback");
  if (!guess) return input.focus();

  const r = game.results[game.index];
  const q = puzzle.questions[game.index];

  if (r.tried.some((t) => norm(t) === norm(guess))) {
    fb.textContent = "Already tried that one.";
    input.select();
    return;
  }

  const hit = findAnswer(q, guess);
  if (!hit) {
    r.tried.push(guess);
    saveGame();
    fb.textContent = pick(["Not on the list. Keep trying.", "Nope. Try another.", "Not on the list. Clock's running…"], r.tried.length - 1);
    app.querySelector(".tried").insertAdjacentHTML("beforeend", `<li>${esc(guess)}</li>`);
    input.value = "";
    input.classList.remove("shake");
    void input.offsetWidth; // restart the animation
    input.classList.add("shake");
    input.focus();
    return;
  }

  Object.assign(r, { guess, answer: hit.display, tier: hit.tier, points: TIERS[hit.tier].points });
  game.phase = "reveal";
  saveGame();
  renderReveal(true);
}

function timeUp() {
  if (game.phase !== "question") return;
  stopTimer();
  Object.assign(game.results[game.index], { tier: 0, points: 0 });
  game.phase = "reveal";
  saveGame();
  renderReveal(true);
}

function next() {
  if (game.index + 1 < puzzle.questions.length) return beginQuestion(game.index + 1);
  game.phase = "done";
  saveGame();
  renderResults();
}

async function share() {
  const s = stats();
  const total = totalOf(game);
  const band = bandFor(altOf(total));
  const lines = [
    `${CONFIG.name} No. ${puzzle.number}${MODE === "archive" ? " (archive)" : ""}`,
    `🎈 ${total} m · ${band.name} ${band.emoji}`,
    game.results.map((r) => TIERS[r.tier].emoji).join(""),
  ];
  if (MODE === "daily" && s.streak >= 2) lines.push(`🔥 ${s.streak}-day streak`);
  lines.push(shareUrl());
  const text = lines.join("\n");

  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied — paste it in the chat");
  } catch {
    window.prompt("Copy this into the chat:", text);
  }
}

function burst(count) {
  const host = app.querySelector(".burst");
  if (!host || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  host.innerHTML = Array.from({ length: count }, (_, i) => {
    const a = (360 / count) * i + Math.random() * 10;
    const d = 70 + Math.random() * 70;
    const delay = 0.25 + Math.random() * 0.2;
    return `<i style="--a:${a}deg;--d:${d}px;--delay:${delay}s"></i>`;
  }).join("");
}

/* ----------------------------- wiring ----------------------------- */

app.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "start") beginQuestion(0);
  else if (action === "next") next();
  else if (action === "share") share();
  else if (action === "replay") { game = newGame(); renderIntro(); }
  else if (action === "reload") location.reload();
});

app.addEventListener("submit", (e) => {
  e.preventDefault();
  submitGuess(e.target.elements.guess.value);
});

function route() {
  const n = puzzle.questions.length;
  if (game.phase !== "intro" && game.phase !== "done" && game.index >= n) game.phase = "done";
  if (game.phase === "intro") renderIntro();
  else if (game.phase === "question") Date.now() >= game.deadline ? timeUp() : renderQuestion();
  else if (game.phase === "reveal") renderReveal(false);
  else renderResults();
}

// Keep the answer bar above the phone keyboard.
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty("--kb", kb + "px");
  };
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
}

async function init() {
  Pixel.mount(document.getElementById("scene"));
  trackKeyboard();
  let text;
  try {
    const res = await fetch(`${CONFIG.puzzleFile}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    text = await res.text();
  } catch {
    return renderError();
  }
  ({ puzzles: PUZZLES, warnings: WARNINGS } = parsePuzzles(text));
  if (WARNINGS.length) console.warn("puzzles.txt:\n" + WARNINGS.join("\n"));

  const params = new URLSearchParams(location.search);
  const today = todayKey();
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  if (params.has("archive")) return renderArchive();

  let date = today;
  if (params.has("preview")) {
    MODE = "preview";
    if (isDate(params.get("preview"))) date = params.get("preview");
  } else if (isDate(params.get("day")) && params.get("day") < today) {
    MODE = "archive";
    date = params.get("day");
  }

  puzzle = PUZZLES.find((p) => p.date === date);
  if (!puzzle) return renderNoPuzzle(date);

  game = (MODE !== "preview" && store.get("game:" + date)) || newGame();
  route();
}

init();
