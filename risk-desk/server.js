"use strict";
/*
 * Risk Desk: Silver Star Mines — live classroom game server (ISI 315 Week 10, Ch 14–15).
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
/* Week 10 — Chapter 14 §§14.4–14.5 and Chapter 15, through the textbook's own Silver Star Mines case.
   "defenses" are the answer choices (the field name the pages read). The default set is the five
   risk-treatment options (Act 2 and the bonus); the other acts bring their own choices. */
const LEVELS = [
  { id: "A", name: "Low", desc: "managed through routine procedures." },
  { id: "B", name: "Medium", desc: "managed by existing monitoring and response procedures." },
  { id: "C", name: "High", desc: "needs management attention; senior leads plan and monitor it." },
  { id: "D", name: "Extreme", desc: "detailed research and planning at the executive/director level." },
];
const CLASSES = [
  { id: "A", name: "Management control", desc: "policies, planning, risk assessment, standards: the issues management must address." },
  { id: "B", name: "Operational control", desc: "carried out mainly by people: procedures, training, contingency plans, physical protection." },
  { id: "C", name: "Technical control", desc: "the correct use of hardware and software security capabilities." },
];
const CHOOSE = [
  { id: "A", name: "Use it", desc: "it reduces the risk enough and is the most cost-effective option." },
  { id: "B", name: "Find a cheaper alternative", desc: "it reduces the risk more than needed." },
  { id: "C", name: "Use an alternative", desc: "it costs more than the risk reduction it provides." },
  { id: "D", name: "Add more or different controls", desc: "it doesn't reduce the risk enough on its own." },
];
const FOLLOW = [
  { id: "A", name: "Maintenance", desc: "periodically review and upgrade controls so they keep working." },
  { id: "B", name: "Security compliance checking", desc: "an audit that verifies the security plan is being followed." },
  { id: "C", name: "Change and configuration management", desc: "review proposed changes and track every system's configuration." },
  { id: "D", name: "Incident handling", desc: "the procedures for responding to a security incident." },
];
const SCADA = [
  { id: "A", name: "Patch every SCADA node now", desc: "install the latest operating system on each node." },
  { id: "B", name: "Monitor the SCADA link and cut it on attack", desc: "an IDS on the firewall link, with automatic disconnect." },
  { id: "C", name: "Replace the whole SCADA system", desc: "new hardware and software across the mine." },
  { id: "D", name: "Accept the risk as it is", desc: "management signs off on the current state." },
];
/* Risk matrix (Table 14.4), shown on screen with every "Rate the risk" round so the game is self-contained. */
const RISK_MATRIX = {
  title: "Risk matrix: find the likelihood row and the consequence column",
  cols: ["Insignificant", "Minor", "Moderate", "Major", "Catastrophic", "Doomsday"],
  short: ["Insig", "Minor", "Mod", "Major", "Cat", "Doom"],
  rows: [
    { label: "Almost certain", short: "Certain", cells: ["High", "High", "Extreme", "Extreme", "Extreme", "Extreme"] },
    { label: "Likely", short: "Likely", cells: ["Medium", "High", "High", "Extreme", "Extreme", "Extreme"] },
    { label: "Possible", short: "Possible", cells: ["Low", "Medium", "High", "Extreme", "Extreme", "Extreme"] },
    { label: "Unlikely", short: "Unlikely", cells: ["Low", "Low", "Medium", "High", "Extreme", "Extreme"] },
    { label: "Rare", short: "Rare", cells: ["Low", "Low", "Medium", "High", "High", "Extreme"] },
  ],
  note: "Rows = likelihood · Columns = consequence. Source: Table 14.4.",
};
const GAME = {
  story:
    "You've been hired as the security analyst for Silver Star Mines, the local operation of a global mining company. Its once-isolated mine-control (SCADA) systems are now connected to the company network, and potentially the internet. Management will accept only Medium or lower risks. Act 1: Rate each risk with the risk matrix shown on screen. Act 2: Choose how to treat it. Act 3: Classify the controls you'd pick. Act 4: Keep the controls working. Every round the class gets wrong, a risk goes unmanaged, so watch the meters.",
  roundSeconds: 90,
  ui: { choosing: "Teams are deciding on their devices…", tap: "Tap your answer.", right: "is right!", wrong: "isn't right" },
  meters: [
    { id: "downtime", label: "Mine downtime (est.)", unit: "hours" },
    { id: "losses", label: "Losses & fines (est.)", unit: "$" },
  ],
  defenses: [
    { id: "A", name: "Accept", desc: "management takes the risk on for business reasons and owns the consequences." },
    { id: "B", name: "Avoid", desc: "don't do the activity or run the system that creates the risk." },
    { id: "C", name: "Transfer", desc: "share the risk with a third party (insurance, a contract, a partner)." },
    { id: "D", name: "Reduce consequence", desc: "limit the damage if it happens (backups, recovery plans, replication)." },
    { id: "E", name: "Reduce likelihood", desc: "make it less likely to happen (firewalls, access tokens, password rules)." },
  ],
  rounds: [
    { act: "Act 1 · Rate the risk", choices: LEVELS, move: "Using the risk matrix, what is the level of risk?", facts: [{"label": "Asset", "value": "Internet router"}, {"label": "Threat", "value": "Outside hacker attack"}, {"label": "Existing controls", "value": "Admin password only"}, {"label": "Likelihood", "value": "Possible"}, {"label": "Consequence", "value": "Moderate"}],
      reference: RISK_MATRIX, works: ["C"], points: 10, impact: { meter: "losses", amount: 150000 },
      why: "Possible × Moderate = High. It's the textbook's own risk-register example (Table 14.5), and the treatment turned out to be cheap: tighten the router configuration.",
      discuss: "High, but cheap to fix. Why would management fix this before a risk rated higher but costly to treat?" },
    { act: "Act 1 · Rate the risk", choices: LEVELS, move: "Using the risk matrix, what is the level of risk?", facts: [{"label": "Asset", "value": "Stored files and databases (production results, contracts, audit records)"}, {"label": "Threat", "value": "Corruption, theft, and loss of information"}, {"label": "Existing controls", "value": "Firewall and policies"}, {"label": "Likelihood", "value": "Possible"}, {"label": "Consequence", "value": "Major"}],
      reference: RISK_MATRIX, works: ["D"], points: 10, impact: { meter: "losses", amount: 400000 },
      why: "Possible × Major = Extreme, the only Extreme risk in Silver Star's register (Table 14.6). Management accepts only Medium or lower, so this one must be treated.",
      discuss: "The firewall and policies were already in place. Why do 'existing controls' still leave a risk this high?" },
    { act: "Act 1 · Rate the risk", choices: LEVELS, move: "Using the risk matrix, what is the level of risk?", facts: [{"label": "Asset", "value": "The SCADA control system that runs the mine"}, {"label": "Threat", "value": "Unauthorized change to the control system"}, {"label": "Existing controls", "value": "Layered firewalls and servers"}, {"label": "Likelihood", "value": "Rare"}, {"label": "Consequence", "value": "Major"}],
      reference: RISK_MATRIX, works: ["C"], points: 20, impact: { meter: "downtime", amount: 720 },
      why: "Rare × Major = High, and it's Silver Star's #1 priority (Table 14.6). A rare event still matters when the consequence is severe. End of Act 1: double points.",
      discuss: "This is rated High but ranked #1, above an Extreme risk. Why might safety and legal records outrank a higher rating?" },
    { act: "Act 2 · Treat the risk", move: "Silver Star buys a cyber-insurance policy that pays for recovery and legal costs if its stored data is corrupted or stolen.",
      works: ["C"], points: 10, impact: { meter: "losses", amount: 300000 },
      why: "Risk transfer: sharing responsibility with a third party, typically through insurance or a contract. The risk still exists; someone else now shares the cost.",
      discuss: "Insurance pays the bill. Can it pay for lost customer trust or a failed safety inspection?" },
    { act: "Act 2 · Treat the risk", move: "Silver Star sets up off-site backups and a disaster-recovery plan so the financial system can be restored within a day.",
      works: ["D"], points: 10, impact: { meter: "downtime", amount: 120 },
      why: "Reduce consequence: the attack is just as likely, but recovery is fast. The book's examples are exactly these: off-site backup, a disaster-recovery plan, replication across sites.",
      discuss: "Backups don't stop the attack. Why are they still one of the most valuable controls?" },
    { act: "Act 2 · Treat the risk", move: "A project to let contractors control mine equipment from home over the internet is cancelled because the risk is too high for the convenience it offers.",
      works: ["B"], points: 10, impact: { meter: "downtime", amount: 240 },
      why: "Risk avoidance: not proceeding with the activity that creates the risk. The trade-off is lost convenience: contractors must be on site.",
      discuss: "Avoidance removes the risk completely. Why don't organizations avoid every risk?" },
    { act: "Act 2 · Treat the risk", move: "Upgrading an old maintenance server would cost far more than its risk justifies. Management signs a statement taking responsibility for running it as is for one more year.",
      works: ["A"], points: 20, impact: { meter: "losses", amount: 250000 },
      why: "Risk acceptance: accepting a level above normal for business reasons, usually cost or time, and management, not IT, takes responsibility for the consequences. End of Act 2: double points.",
      discuss: "Why does acceptance need a signature from management, not just a note from the analyst?" },
    { act: "Act 3 · Pick the control class", choices: CLASSES, move: "Silver Star adopts a written information security policy and a yearly risk-assessment schedule, approved by the board.",
      works: ["A"], points: 10, impact: { meter: "losses", amount: 100000 },
      why: "Management controls: policies, planning, and risk assessment that guide which operational and technical controls get chosen (Table 15.1: Planning, Risk Assessment, Program Management).",
      discuss: "A policy changes nothing on any computer. So how does it reduce risk?" },
    { act: "Act 3 · Pick the control class", choices: CLASSES, move: "Every employee completes security-awareness training, and the server room gets locked doors and fire suppression.",
      works: ["B"], points: 10, impact: { meter: "downtime", amount: 96 },
      why: "Operational controls: carried out mainly by people. Table 15.1 lists Awareness and Training, and Physical and Environmental Protection, as operational, even the locked door.",
      discuss: "A fire-suppression system is a machine. Why does the book still call it operational?" },
    { act: "Act 3 · Pick the control class", choices: CLASSES, move: "The financial system now requires two-step login, logs every privileged command, and encrypts data at rest.",
      works: ["C"], points: 20, impact: { meter: "losses", amount: 350000 },
      why: "Technical controls: the correct use of hardware and software security capabilities: Identification and Authentication, Audit and Accountability, System and Communications Protection (Table 15.1). End of Act 3: double points.",
      discuss: "The book says even technical controls need operational procedures. What procedure does two-step login need?" },
    { act: "Act 4 · Keep it working", choices: CHOOSE, move: "A proposed $400,000 security system would protect a risk already rated Low.",
      works: ["C"], points: 10, impact: { meter: "losses", amount: 400000 },
      why: "If a control costs more than the risk reduction it provides, use an alternative (§15.2). Spending $400,000 on a Low risk is uneconomic (Figure 14.5).",
      discuss: "How would you explain 'no' to the person who proposed it?" },
    { act: "Act 4 · Keep it working", choices: FOLLOW, move: "A vendor releases an urgent patch. Before installing it on the financial servers, IT tests it to make sure the other applications still work, and records the new version installed on each server.",
      works: ["C"], points: 10, impact: { meter: "downtime", amount: 48 },
      why: "Change and configuration management: review each change for its impact, and keep track of every system's configuration (§15.5). Testing first trades a little exposure time for stability, which is a management decision.",
      discuss: "Test the patch first, or install it now? Who should make that call, and what does it depend on?" },
    { act: "Act 4 · Keep it working", choices: SCADA, move: "The #1 risk: the SCADA nodes run old operating systems with known flaws and CAN'T be patched, because the mine-control software won't run on newer versions. Two facts: the nodes were designed to run with no network at all (the link only adds remote monitoring), and their network traffic is highly regular and predictable. Which control fits best?",
      works: ["B"], points: 20, impact: { meter: "downtime", amount: 1440 },
      why: "Protect the link, not the node: SCADA traffic is highly predictable, so an intrusion-detection system can spot attacks reliably and automatically sever the network connection. The nodes were designed to run without it; all that's lost is remote monitoring (§15.6). Final round: double points.",
      discuss: "The book's answer accepts losing the network connection in an attack. Why is that an acceptable price here?" },
  ],
  bonus: { prompt: "Silver Star's #2 risk is stored file and database integrity, rated Extreme. Which ONE treatment would you lead with?", points: 10,
           note: "Any answer earns the points. The book leans on both reduce options: general controls such as patching, malware protection, and auditing lower the likelihood; backups, recovery, and better document management lower the consequence." },
  champion: "Risk Masters",
  revealTitle: "What you just did",
  reveal:
    "You just took Silver Star Mines through the full process from Chapters 14 and 15: rating each risk from its likelihood and consequence, choosing a treatment that fits management's risk appetite, classifying the controls, and keeping them working once they're in place. The textbook's analyst reached the same conclusions, including the SCADA answer: when a system can't be patched, protect the connection around it and be ready to cut it.",
  lessonsTitle: "Four rules to keep",
  lessons: [
    ["A rare risk can still be your top priority.", "Severe consequences keep a Rare risk at High; Silver Star's SCADA risk ranked #1."],
    ["There are five ways to treat a risk.", "Accept, avoid, transfer, reduce consequence, or reduce likelihood. Acceptance is a management decision, made in writing."],
    ["Controls come in three classes.", "Management (policy and planning), operational (people and procedures, including physical security), technical (hardware and software)."],
    ["The cycle never ends.", "Maintenance, compliance checking, change and configuration management, and incident handling keep the chosen risk level from drifting."],
  ],
  debrief: [
    "Which treatment did your team find hardest to tell apart, and what's the difference in one sentence?",
    "Name one control that is in more than one class. (The book says some controls include features of several.)",
    "For your project organization: what's your Extreme or High risk, and which treatment will you recommend?",
  ],
  debriefKey: "Hard pair: reduce consequence (smaller damage: backups, DR) vs. transfer (someone else pays: insurance). Multi-class example: incident response has a policy (management), a procedure (operational), and alerting tools (technical).",
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
    st.facts = r.facts || null;           // labelled asset / threat / likelihood / consequence
    st.reference = r.reference || null;   // information needed to answer, shown with the question
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
server.listen(PORT, () => console.log("Risk Desk running on port " + PORT));
