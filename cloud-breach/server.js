"use strict";
/*
 * Stop the Breach: Cloud & IoT — live classroom game server (ISI 315 Week 9).
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
/* "defenses" are the answer choices (the field name the pages read). Act 1 uses the six cloud
   defenses; Act 2 rounds bring the six IoT defenses as their own choices. */
const IOT = [
  { id: "A", name: "Unique passwords from day one", desc: "no factory defaults — every device gets its own password at install." },
  { id: "B", name: "A separate network for devices", desc: "cameras and sensors sit on their own segment, walled off from everything else." },
  { id: "C", name: "Hide devices behind the gateway", desc: "the internet can't reach them; only the campus management server can." },
  { id: "D", name: "Limit what devices can send out", desc: "the gateway blocks devices from flooding or contacting unknown sites (egress filtering)." },
  { id: "E", name: "Watch devices for odd behavior", desc: "alert when a camera suddenly scans the network or sends huge traffic." },
  { id: "F", name: "Buy only devices that can be updated", desc: "a purchasing rule: an update path, a support period, no hard-coded passwords." },
];
const GAME = {
  story:
    "Two attacks, two acts. ACT 1 — Harbor Bank moved its credit-card applications to a public cloud (IaaS). The provider runs the data centers and hypervisor; Harbor Bank runs its servers, its web-application firewall, its access settings, and storage holding millions of applications. ACT 2 — Riverside College is building a smart campus: 2,300 cameras, door controllers, and sensors, none of them patchable. Each round, the attacker makes a move. When most teams pick a defense that fails, the attacker gets through — watch the damage meters.",
  ui: { choosing: "Teams are choosing a defense on their devices…", tap: "Tap the defense that stops this.", right: "works!", wrong: "wouldn't stop this" },
  meters: [
    { id: "records", label: "Records stolen", act: "Act 1 · Cloud" },
    { id: "ssn", label: "SSNs & account numbers exposed", act: "Act 1 · Cloud" },
    { id: "bots", label: "Campus devices hijacked", act: "Act 2 · IoT" },
    { id: "traffic", label: "Attack traffic sent", unit: "Gbps", act: "Act 2 · IoT" },
  ],
  defenses: [
    { id: "A", name: "Review the firewall's settings", desc: "someone checks the web-application firewall's configuration before and after every change." },
    { id: "B", name: "Give the server one key only", desc: "the server's cloud role can read only the storage it actually needs (least privilege)." },
    { id: "C", name: "Lock the server's key cabinet", desc: "turn on the cloud's protected setting so a server can't be tricked into handing out its own access keys." },
    { id: "D", name: "Alarm on unusual cloud activity", desc: "alert when an account suddenly does something new — like listing hundreds of storage buckets." },
    { id: "E", name: "Watch the data leaving", desc: "flag large or unusual downloads out of cloud storage." },
    { id: "F", name: "Scramble the most sensitive fields", desc: "replace Social Security and account numbers with tokens, so stolen copies are useless (tokenization)." },
  ],
  rounds: [
    { act: "Act 1 · Cloud", move: "An attacker sends specially crafted web requests to Harbor Bank's site. Its web-application firewall is misconfigured and lets them through to the server behind it.",
      works: ["A"], points: 10, impact: { meter: "records", amount: 20000000 },
      why: "Reviewing the firewall's configuration (A) catches the setting that let these requests through. This is the customer's side of the line — the provider never touches it.",
      discuss: "The provider supplies the firewall service. Whose job is it to configure it correctly — and who gets blamed if it's wrong?" },
    { act: "Act 1 · Cloud", move: "Through the firewall, the attacker tricks the server into asking the cloud for its own temporary access keys — and the cloud hands them over.",
      works: ["C"], points: 10, impact: { meter: "records", amount: 20000000 },
      why: "Locking the key cabinet (C) — the cloud's protected setting for that request — means the server can't be tricked into fetching its keys for an outsider. The provider offers it; the customer has to switch it on.",
      discuss: "The provider offered this protection, but it was optional. Is an optional security setting the provider's responsibility or the customer's?" },
    { act: "Act 1 · Cloud", move: "Those keys belong to the server's cloud role — and that role can list and read every storage bucket in the account, more than 700 of them.",
      works: ["B"], points: 10, impact: { meter: "records", amount: 30000000 },
      why: "One key only (B): if the server's role could read only the storage it needed, stolen keys would open one bucket, not seven hundred.",
      discuss: "Why do teams give a server's role more access than it needs? Think about deadlines and 'just make it work.'" },
    { act: "Act 1 · Cloud", move: "Using the stolen keys from outside the bank, the attacker lists hundreds of buckets and, over a few days, copies millions of card-application records out of cloud storage.",
      works: ["D", "E"], points: 10, impact: { meter: "records", amount: 36000000 },
      why: "An alarm on unusual cloud activity (D) flags a role suddenly listing hundreds of buckets; watching the data leaving (E) catches gigabytes heading out. Either could have cut the theft short. Detection is still the customer's job in IaaS.",
      discuss: "The cloud logs every request. Logging is easy — so why do so many organizations never look at those logs?" },
    { act: "Act 1 · Cloud", move: "Among the stolen files: Social Security numbers and bank account numbers for customers.",
      works: ["F"], points: 20, impact: { meter: "ssn", amount: 220000 },
      why: "Scrambling the most sensitive fields (F) doesn't stop the theft — it makes the stolen copies worthless. It lowers the CONSEQUENCE, not the likelihood. End of Act 1 — double points.",
      discuss: "Defenses A–E try to stop the attack. F assumes the attack will succeed. Why would a bank plan for losing?" },
    { act: "Act 2 · IoT", choices: IOT, move: "Riverside College installs 400 new security cameras, plugged straight into the internet. Within hours, malware scanning the internet finds their login pages.",
      works: ["C"], points: 10, impact: { meter: "bots", amount: 400 },
      why: "Hiding devices behind the gateway (C) means the internet can't reach the cameras at all — only the campus management server can. No reachable login page, nothing to try.",
      discuss: "Why would anyone put a camera directly on the internet? Think remote viewing, convenience, and the installer's default settings." },
    { act: "Act 2 · IoT", choices: IOT, move: "The malware tries a built-in list of about 60 factory usernames and passwords. One of them works on every camera.",
      works: ["A"], points: 10, impact: { meter: "bots", amount: 800 },
      why: "Unique passwords from day one (A): with no factory defaults, a list of 60 printed passwords opens nothing. There was no clever exploit — the passwords were in the manual.",
      discuss: "The password was printed in the manual. Whose fault is that — the maker, the installer, or the college?" },
    { act: "Act 2 · IoT", choices: IOT, move: "From inside, each infected camera scans the campus network for other devices — door controllers, sensors — and infects them too.",
      works: ["B", "E"], points: 10, impact: { meter: "bots", amount: 1100 },
      why: "A separate network for devices (B) stops the spread to everything else; watching devices for odd behavior (E) catches a camera that suddenly starts scanning. The controls sit around the device, not on it.",
      discuss: "None of these devices can run antivirus or be patched. So where can a defense actually live?" },
    { act: "Act 2 · IoT", choices: IOT, move: "The botnet's operator sends one command: flood a news website with traffic. Every hijacked device on campus joins in.",
      works: ["D", "E"], points: 10, impact: { meter: "traffic", amount: 40 },
      why: "Limiting what devices can send out (D) stops campus devices from flooding anyone; watching for odd behavior (E) spots the surge in seconds. Your hijacked devices hurting someone else is still your problem.",
      discuss: "The flood hurts a news site, not the college. Why should the college care — and could it be held responsible?" },
    { act: "Act 2 · IoT", choices: IOT, move: "Months later the camera maker releases a fix — but these cameras have no way to install updates. Next year the college plans to buy 2,000 more devices.",
      works: ["F"], points: 20, impact: { meter: "bots", amount: 2000 },
      why: "Buying only devices that can be updated (F) is the one control you set before a device ever arrives. Procurement rules belong in the security policy — that's Thursday. End of Act 2 — double points.",
      discuss: "Who at a college actually signs the purchase order for cameras? Do they ever talk to security?" },
  ],
  bonus: { prompt: "Harbor Bank can fund only ONE of these six cloud defenses next year. Which one?", points: 10,
           note: "Any answer earns the points. Strong cases: B (least privilege shrinks every future breach) or D/E (you can't stop what you can't see). F is the only one that still helps after everything else fails." },
  champion: "Breach Busters",
  revealTitle: "This really happened — twice",
  reveal:
    "Act 1 was Capital One in 2019. A misconfigured web-application firewall in Capital One's own cloud setup let an attacker trick a server into handing over its cloud access keys. Those keys could read far more storage than the server needed, and the attacker copied data on about 100 million people in the U.S. and 6 million in Canada, including roughly 140,000 Social Security numbers and 80,000 bank account numbers. Most Social Security numbers were tokenized, which limited the damage. The cloud provider was never breached. Act 2 was the Mirai botnet in 2016. It scanned the internet for cameras, video recorders, and routers still using factory logins, tried about 60 username and password pairs, and enlisted hundreds of thousands of devices. In September it hit KrebsOnSecurity with a record-scale attack; on October 21 it attacked DNS provider Dyn and disrupted major websites across the U.S.",
  lessonsTitle: "Why they lost",
  lessons: [
    ["Nobody hacked the cloud.", "Every Capital One failure sat on the customer's side of the shared-responsibility line: the firewall setting, the keys, the permissions."],
    ["One role, too many keys.", "A server that needed one bucket could read 700. Least privilege would have shrunk the theft to almost nothing."],
    ["Planning for failure paid off.", "Tokenization protected most Social Security numbers. It didn't prevent the breach; it limited the consequence."],
    ["Nobody hacked the cameras either.", "Mirai used passwords printed in manuals. The fixes — segmentation, gateway filtering, egress rules, and purchasing rules — all sit around the device, not on it."],
  ],
  debrief: [
    "Draw the responsibility line: which of the six cloud defenses were Capital One's job, and which were the provider's?",
    "Which defenses lower the likelihood, and which lower the consequence? Find one of each in both acts.",
    "Which damage meter was hardest for the class to keep at zero — and what does that say about where organizations are weakest?",
  ],
  debriefKey: "Responsibility: all six cloud defenses were Capital One's job; the provider offered C as an optional setting. Consequence-lowering: F (tokenization) in Act 1; D (egress limits) in Act 2 limits harm to others. Everything else mainly lowers likelihood.",
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
server.listen(PORT, () => console.log("Stop the Breach: Cloud & IoT running on port " + PORT));
