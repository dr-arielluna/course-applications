"use strict";
/*
 * Risk Ready — live classroom game server (ISI 315 Week 9).
 * Built on the Stop the Breach engine: same rooms, rounds, scoring, and reveal.
 * Express serves the three static pages; Socket.IO runs the realtime game.
 * Rooms are kept in memory (fine for a classroom / single instance).
 * The server is authoritative: clients never receive the answer key until a
 * reveal, so students can't read ahead in the page source.
 */
const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const crypto = require("crypto");

const app = express();
app.use(express.static(path.join(__dirname, "public")));
const server = http.createServer(app);
const io = new Server(server);

/* ----------------------------- GAME CONTENT ----------------------------- */
/* "defenses" are the answer choices (the field name the pages read). The default set is the four
   risk-assessment approaches; "Name it" and "Which lever?" rounds bring their own choices. */
const TERMS = [
  { id: "A", name: "Asset", desc: "anything of value to the organization." },
  { id: "B", name: "Threat", desc: "a potential cause of an unwanted incident." },
  { id: "C", name: "Vulnerability", desc: "a weakness a threat can exploit." },
  { id: "D", name: "Consequence", desc: "the impact if the threat succeeds." },
];
const LEVERS = [
  { id: "A", name: "Lowers the likelihood", desc: "makes the incident less likely to happen." },
  { id: "B", name: "Lowers the consequence", desc: "makes the damage smaller if it does happen." },
];
const GAME = {
  story:
    "You've just been hired as a risk analyst. Each round, a real situation lands on your desk. ACT 1 — Name it: label the risk using the six words from §14.3. ACT 2 — Which lever? Decide whether a control lowers the likelihood or the consequence. ACT 3 — Pick the approach: baseline, informal, detailed, or combined, for very different organizations. Every round the class gets wrong, the risk goes unmanaged — watch the meter climb.",
  roundSeconds: 90,
  ui: { choosing: "Teams are deciding on their devices…", tap: "Tap your answer.", right: "is right!", wrong: "isn't right" },
  meters: [ { id: "exposure", label: "Risk left unmanaged (est.)", unit: "$" } ],
  defenses: [
    { id: "A", name: "Baseline", desc: "apply a standard control set from industry practice. Cheap and quick." },
    { id: "B", name: "Informal", desc: "experts judge the main risks. Fast, but may miss some." },
    { id: "C", name: "Detailed", desc: "formal, structured analysis of each system. Thorough but costly." },
    { id: "D", name: "Combined", desc: "baseline everywhere, detailed analysis for the high-risk systems." },
  ],
  rounds: [
    { act: "Act 1 · Name it", choices: TERMS, move: "A city water plant's pump controller still uses its factory password and can be reached from the internet. In risk terms, \"still uses its factory password\" is the…",
      works: ["C"], points: 10, impact: { meter: "exposure", amount: 1500000 },
      why: "A vulnerability is a weakness a threat can exploit. The controller is the asset; whoever might log in is the threat; contaminated water or a shutdown would be the consequence.",
      discuss: "If the vulnerability is fixed but the threat is still out there, has the risk gone down? Why?" },
    { act: "Act 1 · Name it", choices: TERMS, move: "Crime groups are emailing fake invoices to every accounts-payable team in the region this month. The crime groups are the…",
      works: ["B"], points: 10, impact: { meter: "exposure", amount: 250000 },
      why: "A threat is a potential cause of an unwanted incident. You can't patch a threat — you can only lower its chance of success or limit the damage.",
      discuss: "Can an organization ever lower a threat directly? Or only its own vulnerabilities and consequences?" },
    { act: "Act 1 · Name it", choices: TERMS, move: "A dental office keeps all patient X-rays and billing on one PC with no backup. If the disk dies, it can't bill for three weeks and must notify 4,000 patients. The lost billing and the notifications are the…",
      works: ["D"], points: 10, impact: { meter: "exposure", amount: 180000 },
      why: "Consequence is the impact if the threat succeeds — and it's valued by what the practice loses, not by what the PC cost. The patient records are the asset; no backup is the vulnerability.",
      discuss: "The PC cost $900. Why is the asset worth far more than that?" },
    { act: "Act 2 · Which lever?", choices: LEVERS, move: "A bank turns on two-step login for every staff email account.",
      works: ["A"], points: 10, impact: { meter: "exposure", amount: 400000 },
      why: "Two-step login makes a stolen password far less likely to work — it lowers the likelihood. If an account were still taken over, the damage would be the same.",
      discuss: "Name a way to lower the consequence of an email takeover, too." },
    { act: "Act 2 · Which lever?", choices: LEVERS, move: "An accounting firm encrypts every laptop's disk.",
      works: ["B"], points: 10, impact: { meter: "exposure", amount: 600000 },
      why: "Encryption doesn't make a laptop less likely to be lost or stolen — it makes the loss harmless. It lowers the consequence.",
      discuss: "Breach-notification laws often exempt encrypted data. Why would lawmakers reward the consequence lever?" },
    { act: "Act 3 · Pick the approach", move: "A three-person bookkeeping office: standard PCs, cloud email, no IT staff, and a tiny budget.",
      works: ["A"], points: 10, impact: { meter: "exposure", amount: 120000 },
      why: "Baseline: a standard control set is cheap, quick, and needs little expertise — the book recommends it for small organizations without the resources for a structured analysis.",
      discuss: "What's the danger of a baseline for an office this small — what might it miss?" },
    { act: "Act 3 · Pick the approach", move: "The company that operates the state's electric grid — critical national infrastructure.",
      works: ["C"], points: 10, impact: { meter: "exposure", amount: 5000000 },
      why: "Detailed: formal, structured analysis of each system. It's slow and costly, but when failure affects millions of people, you need the strongest justification for every control.",
      discuss: "Who would demand to see this analysis — and what would they do if it were missing?" },
    { act: "Act 3 · Pick the approach", move: "A university with a teaching hospital, research labs, and thousands of student systems.",
      works: ["D"], points: 20, impact: { meter: "exposure", amount: 3000000 },
      why: "Combined: a quick high-level pass, a baseline everywhere, and detailed analysis for the high-risk systems — the hospital and research data. ISO 13335 rates it the most cost-effective for most organizations. Final round — double points.",
      discuss: "Which three systems at this university get the detailed analysis, and why those?" },
  ],
  bonus: { prompt: "Which approach would you recommend for OUR university's IT department? Be ready to defend it.", points: 10,
           note: "Any answer earns the points. Most would argue Combined: baseline across the campus, detailed analysis for the systems that hold health, research, or financial data." },
  champion: "Risk Masters",
  revealTitle: "What you just practiced",
  reveal:
    "Every round was a decision a real risk analyst makes: naming the risk precisely, choosing which lever a control pulls, and matching the depth of the assessment to the organization. Get the words right and the analysis follows; get them wrong and you spend money on the wrong control. This is exactly the method your project's risk register uses.",
  lessonsTitle: "Three rules to keep",
  lessons: [
    ["Name it before you fix it.", "Asset = what's at stake; threat = what might cause harm; vulnerability = the weakness; consequence = the damage. Risk is a function of likelihood and consequence."],
    ["Two levers, not one.", "Some controls lower likelihood (two-step login, patching); others lower consequence (encryption, backups). A good plan uses both."],
    ["Match the approach to the organization.", "Baseline for the small and simple, detailed for critical infrastructure, combined for most: detail where the risk is highest."],
  ],
  debrief: [
    "Which round split the class most — and did anyone change their mind once the votes were shown?",
    "Name one control that lowers BOTH the likelihood and the consequence.",
    "For your own project organization: baseline, informal, detailed, or combined — and why?",
  ],
  debriefKey: "Both levers at once: network segmentation (harder to reach lowers likelihood; limiting spread lowers consequence), or least privilege.",
};

const pub = (list) => list.map((d) => ({ id: d.id, name: d.name, desc: d.desc }));
const PUBLIC_DEFENSES = pub(GAME.defenses);
/* the choices on screen right now: a round may bring its own; the bonus uses the default six */
function currentChoices(room) {
  const r = (room.phase === "round" || room.phase === "reveal") ? GAME.rounds[room.round] : null;
  return (r && r.choices) || GAME.defenses;
}

/* ------------------------------- ROOMS ---------------------------------- */
/* rooms[pin] = { hostId, hostKey, phase, round, players:{token:{name,score,answer,counted,socketId,connected}} }
 * Players are keyed by a token their browser keeps, not by socket id, so a phone that locks
 * and reconnects gets its seat (and score) back. A host that drops has 10 minutes to resume. */
const HOST_GRACE_MS = 10 * 60 * 1000;
const rooms = {};

function makePin() {
  let pin;
  do { pin = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms[pin]);
  return pin;
}
function scoreboard(room) {
  // Competition ranking: tied teams share a place (1, 1, 3) and are listed alphabetically —
  // never ordered by who happened to join first.
  const rows = Object.values(room.players)
    .map((p) => ({ name: p.name, score: p.score, streak: p.streak || 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  rows.forEach((r) => {
    r.rank = 1 + rows.filter((o) => o.score > r.score).length;
    r.tied = rows.filter((o) => o.score === r.score).length > 1;
  });
  return rows;
}
// one team's own place, sent privately so duplicate team names can't confuse it
function placeOf(room, p) {
  const all = Object.values(room.players);
  return { rank: 1 + all.filter((o) => o.score > p.score).length,
           tiedWith: all.filter((o) => o !== p && o.score === p.score).map((o) => o.name),
           of: all.length, topScore: Math.max(0, ...all.map((o) => o.score)) };
}
function answeredCount(room) {
  return Object.values(room.players).filter((p) => p.answer != null).length;
}
function letterCounts(room) {
  const c = {};
  currentChoices(room).forEach((d) => (c[d.id] = 0));
  Object.values(room.players).forEach((p) => { if (p.answer && c[p.answer] != null) c[p.answer]++; });
  return c;
}
function publicState(room) {
  const st = {
    phase: room.phase,
    round: room.round,
    total: GAME.rounds.length,
    champion: GAME.champion,
    story: GAME.story,
    defenses: pub(currentChoices(room)),
    scoreboard: scoreboard(room),
    players: Object.values(room.players).map((p) => p.name),
    answered: answeredCount(room),
    playerCount: Object.keys(room.players).length,
    ui: GAME.ui || {},
    meters: publicMeters(room),
  };
  st.timer = (room.phase === "round" || room.phase === "bonus") ? publicTimer(room) : null;
  if (room.phase === "round" || room.phase === "reveal") {
    const r = GAME.rounds[room.round];
    st.move = r.move; st.points = r.points; st.customChoices = !!r.choices; st.act = r.act || "";
    st.votesShown = !!room.votesShown; if (room.votesShown && room.phase === "round") st.counts = letterCounts(room);
  }
  if (room.phase === "bonus" || room.phase === "bonusReveal") {
    st.prompt = GAME.bonus.prompt; st.points = GAME.bonus.points;
    if (room.phase === "bonusReveal") st.note = GAME.bonus.note;
  }
  if (room.phase === "reveal") {
    const r = GAME.rounds[room.round];
    st.works = r.works; st.why = r.why; st.counts = letterCounts(room); st.discuss = r.discuss; st.lesson = r.lesson; st.impact = room.lastImpact;
  }
  if (room.phase === "results") {
    st.reveal = GAME.reveal; st.revealTitle = GAME.revealTitle; st.lessonsTitle = GAME.lessonsTitle;
    st.lessons = GAME.lessons; st.debrief = GAME.debrief; st.debriefKey = GAME.debriefKey;
  }
  return st;
}
function broadcast(pin) {
  const room = rooms[pin];
  if (!room) return;
  io.to(pin).emit("state", publicState(room));
  // personal line to each player
  Object.values(room.players).forEach((p) => {
    if (p.connected) io.to(p.socketId).emit("you", { name: p.name, score: p.score, answer: p.answer, place: placeOf(room, p), streak: p.streak || 0, streakBonus: !!p.streakBonus });
  });
}
function resetAnswers(room) {
  Object.values(room.players).forEach((p) => { p.answer = null; p.counted = false; });
  room.votesShown = false;
}

/* ------------------------- METER, STREAKS, VOTES ------------------------- */
/* Breach meter: a round may carry an impact on one of GAME.meters. At reveal, if fewer than half
 * of all teams chose a working answer, the class "let it through" and the meter climbs.
 * Streak bonus: +STREAK_BONUS each time a team reaches 3, 6, 9… correct answers in a row.
 * Vote reveal: the host can lock answers and show the class split before revealing the answer. */
const STREAK_BONUS = 5;
function freshMeters() { const m = {}; (GAME.meters || []).forEach((x) => (m[x.id] = 0)); return m; }
function publicMeters(room) {
  return (GAME.meters || []).map((x) => ({ id: x.id, label: x.label, unit: x.unit || "", value: (room.meters || {})[x.id] || 0, act: x.act || "" }));
}
function scoreRoundExtras(room, r) {
  const all = Object.values(room.players);
  const correct = all.filter((p) => p.answer && r.works.includes(p.answer)).length;
  all.forEach((p) => {
    p.streakBonus = false;
    if (p.answer && r.works.includes(p.answer)) {
      p.streak = (p.streak || 0) + 1;
      if (p.streak % 3 === 0) { p.score += STREAK_BONUS; p.streakBonus = true; }
    } else p.streak = 0;
  });
  room.lastImpact = null;
  if (r.impact && GAME.meters) {
    const through = all.length === 0 || correct * 2 < all.length;
    if (through) room.meters[r.impact.meter] = (room.meters[r.impact.meter] || 0) + r.impact.amount;
    room.lastImpact = { through, meter: r.impact.meter, amount: r.impact.amount, correct, total: all.length,
                        text: through ? (r.impact.through || "") : (r.impact.blocked || "") };
  }
}

/* ------------------------------- TIMER ---------------------------------- */
/* Each round runs a visible countdown (120 s; bonus 60 s). At zero, answers lock — but the
 * host still decides when to reveal, so discussion is never cut off. Once every connected
 * team has answered, the clock holds; it resumes if a team rejoins without an answer.
 * The host can pause/resume or add 30 s. */
const ROUND_SECONDS = Number(process.env.ROUND_SECONDS) || GAME.roundSeconds || 120, BONUS_SECONDS = Number(process.env.BONUS_SECONDS) || 60, EXTEND_SECONDS = 30;
function clearTimer(room) { if (room.timer) clearTimeout(room.timer.handle); room.timer = null; }
function timerLeft(t) { return (t.paused || t.locked || t.held) ? t.remainingMs : Math.max(0, t.endsAt - Date.now()); }
function armTimer(pin, room) {
  const t = room.timer; clearTimeout(t.handle);
  t.handle = setTimeout(() => {
    if (rooms[pin] !== room || room.timer !== t) return;
    t.locked = true; t.remainingMs = 0; broadcast(pin);
  }, Math.max(0, t.endsAt - Date.now()));
}
function startTimer(pin, room, seconds) {
  clearTimer(room);
  room.timer = { totalMs: seconds * 1000, endsAt: Date.now() + seconds * 1000, remainingMs: seconds * 1000,
                 paused: false, held: false, locked: false, handle: null };
  armTimer(pin, room);
}
function allAnswered(room) {
  const on = Object.values(room.players).filter((p) => p.connected);
  return on.length > 0 && on.every((p) => p.answer != null);
}
function syncHold(pin, room) {
  const t = room.timer; if (!t || t.locked) return;
  const all = allAnswered(room);
  if (all && !t.held) { t.remainingMs = timerLeft(t); t.held = true; clearTimeout(t.handle); }
  else if (!all && t.held) { t.held = false; if (!t.paused) { t.endsAt = Date.now() + t.remainingMs; armTimer(pin, room); } }
}
function publicTimer(room) {
  const t = room.timer; if (!t) return null;
  return { totalMs: t.totalMs, remainingMs: timerLeft(t), running: !t.paused && !t.locked && !t.held,
           paused: t.paused, held: t.held, locked: t.locked };
}

/* ------------------------------ SOCKETS --------------------------------- */
io.on("connection", (socket) => {
  socket.data.role = null;
  socket.data.pin = null;

  socket.on("host:create", async (payload) => {
    // a host whose screen slept or reloaded resumes its own room with the key it was given
    const resume = payload && payload.resume;
    let pin, room = resume && rooms[String(resume.pin)];
    if (room && resume.hostKey === room.hostKey) {
      pin = String(resume.pin);
      clearTimeout(room.closeTimer); room.closeTimer = null;
      room.hostId = socket.id;
    } else {
      pin = makePin();
      room = rooms[pin] = { hostId: socket.id, hostKey: crypto.randomBytes(12).toString("hex"), phase: "lobby", round: 0, players: {}, meters: freshMeters(), lastImpact: null, votesShown: false };
    }
    socket.data.role = "host"; socket.data.pin = pin;
    socket.join(pin);
    const origin = (payload && typeof payload.origin === "string") ? payload.origin.replace(/\/+$/, "") : "";
    const joinUrl = origin + "/play.html?pin=" + pin;
    let qr = null;
    try { qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 320 }); } catch (e) { /* QR optional */ }
    socket.emit("host:created", { pin, qr, joinUrl, hostKey: room.hostKey });
    broadcast(pin);
  });

  socket.on("player:join", ({ pin, name, token }) => {
    pin = String(pin || "").trim();
    name = String(name || "").trim().slice(0, 24) || "Player";
    token = /^[A-Za-z0-9_-]{8,64}$/.test(String(token || "")) ? String(token) : socket.id;
    const room = rooms[pin];
    if (!room) { socket.emit("join:error", "No game with that PIN. Check the code on the screen."); return; }
    socket.data.role = "player"; socket.data.pin = pin; socket.data.token = token;
    socket.join(pin);
    const p = room.players[token];
    if (p) { p.socketId = socket.id; p.connected = true; }   // returning device: keep name and score
    else room.players[token] = { name, score: 0, answer: null, counted: false, socketId: socket.id, connected: true };
    socket.emit("join:ok", { pin, name: room.players[token].name });
    syncHold(pin, room);
    broadcast(pin);
  });

  socket.on("host:start", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId) return;
    room.phase = "round"; room.round = 0; resetAnswers(room); startTimer(socket.data.pin, room, ROUND_SECONDS);
    broadcast(socket.data.pin);
  });

  socket.on("player:answer", ({ letter }) => {
    const room = rooms[socket.data.pin];
    if (!room) return;
    const p = room.players[socket.data.token];
    if (!p) return;
    if (room.phase !== "round" && room.phase !== "bonus") return;
    if (room.timer && room.timer.locked) return; // time is up for this round
    if (room.votesShown) return;                 // votes are on screen: answers are final
    // answers can be changed freely until the host reveals (reveal flips the phase)
    if (!currentChoices(room).some((d) => d.id === letter)) return;
    p.answer = letter;
    syncHold(socket.data.pin, room);
    broadcast(socket.data.pin);
  });

  socket.on("host:reveal", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId) return;
    clearTimer(room);
    if (room.phase === "round") {
      const r = GAME.rounds[room.round];
      Object.values(room.players).forEach((p) => {
        if (!p.counted && p.answer && r.works.includes(p.answer)) { p.score += r.points; }
        p.counted = true;
      });
      scoreRoundExtras(room, r);
      room.phase = "reveal";
    } else if (room.phase === "bonus") {
      Object.values(room.players).forEach((p) => {
        if (!p.counted && p.answer) { p.score += GAME.bonus.points; }
        p.counted = true;
      });
      room.phase = "bonusReveal";
    }
    broadcast(socket.data.pin);
  });

  socket.on("host:next", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId) return;
    if (room.phase === "reveal") {
      if (room.round + 1 < GAME.rounds.length) {
        room.round += 1; room.phase = "round"; resetAnswers(room); startTimer(socket.data.pin, room, ROUND_SECONDS);
      } else {
        room.phase = "bonus"; resetAnswers(room); startTimer(socket.data.pin, room, BONUS_SECONDS);
      }
    } else if (room.phase === "bonusReveal") {
      room.phase = "results"; clearTimer(room);
    }
    broadcast(socket.data.pin);
  });

  socket.on("host:restart", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId) return;
    room.phase = "lobby"; room.round = 0; clearTimer(room); room.meters = freshMeters(); room.lastImpact = null; room.votesShown = false;
    Object.values(room.players).forEach((p) => { p.streak = 0; p.streakBonus = false; });
    Object.values(room.players).forEach((p) => { p.score = 0; p.answer = null; p.counted = false; });
    broadcast(socket.data.pin);
  });

  // vote reveal (host only): lock answers and show how the class split, before the answer
  socket.on("host:votes", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId || room.phase !== "round") return;
    room.votesShown = true;
    if (room.timer) { const t = room.timer; t.remainingMs = timerLeft(t); t.locked = true; clearTimeout(t.handle); }
    broadcast(socket.data.pin);
  });

  // timer controls (host only): pause/resume, and +30 s (also re-opens answers after time-up)
  socket.on("host:pause", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId || !room.timer || room.timer.locked) return;
    const t = room.timer;
    if (!t.paused) { t.remainingMs = timerLeft(t); t.paused = true; clearTimeout(t.handle); }
    else { t.paused = false; if (!t.held) { t.endsAt = Date.now() + t.remainingMs; armTimer(socket.data.pin, room); } }
    broadcast(socket.data.pin);
  });
  socket.on("host:extend", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId || !room.timer || room.votesShown) return;
    const t = room.timer, left = timerLeft(t) + EXTEND_SECONDS * 1000;
    t.locked = false; t.remainingMs = left; t.totalMs = Math.max(t.totalMs, left);
    if (!t.paused && !t.held) { t.endsAt = Date.now() + left; armTimer(socket.data.pin, room); }
    syncHold(socket.data.pin, room);
    broadcast(socket.data.pin);
  });

  // the deliberate end: the host closes the game for every device
  socket.on("host:end", () => {
    const pin = socket.data.pin; const room = rooms[pin];
    if (!room || socket.id !== room.hostId) return;
    clearTimeout(room.closeTimer); clearTimer(room);
    io.to(pin).emit("host:gone");
    delete rooms[pin];
  });

  socket.on("disconnect", () => {
    const pin = socket.data.pin; const room = rooms[pin];
    if (!room) return;
    if (socket.data.role === "host" && socket.id === room.hostId) {
      // keep the game alive while the host's screen sleeps; close it only if they never come back
      clearTimeout(room.closeTimer);
      room.closeTimer = setTimeout(() => {
        if (rooms[pin] === room) { clearTimer(room); io.to(pin).emit("host:gone"); delete rooms[pin]; }
      }, HOST_GRACE_MS);
      return;
    }
    if (socket.data.role === "player") {
      const p = room.players[socket.data.token];
      if (p && p.socketId === socket.id) {
        if (room.phase === "lobby") delete room.players[socket.data.token]; // nothing to lose yet
        else p.connected = false;                                           // keep seat and score
        syncHold(pin, room);
        broadcast(pin);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Risk Ready running on port " + PORT));
