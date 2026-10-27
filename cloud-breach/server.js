"use strict";
/*
 * Stop the Breach: Cloud — live classroom game server (ISI 315 Week 9).
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
const GAME = {
  story:
    "Harbor Bank moved its credit-card application system to a public cloud (IaaS). The cloud provider runs the data centers, hardware, and hypervisor. Harbor Bank runs everything above that: its servers, its web-application firewall, its access settings, and its storage of millions of card applications — names, incomes, credit scores. One spring, someone attacks.",
  defenses: [
    { id: "A", name: "Review the firewall's settings", desc: "someone checks the web-application firewall's configuration before and after every change." },
    { id: "B", name: "Give the server one key only", desc: "the server's cloud role can read only the storage it actually needs (least privilege)." },
    { id: "C", name: "Lock the server's key cabinet", desc: "turn on the cloud's protected setting so a server can't be tricked into handing out its own access keys." },
    { id: "D", name: "Alarm on unusual cloud activity", desc: "alert when an account suddenly does something new — like listing hundreds of storage buckets." },
    { id: "E", name: "Watch the data leaving", desc: "flag large or unusual downloads out of cloud storage." },
    { id: "F", name: "Scramble the most sensitive fields", desc: "replace Social Security and account numbers with tokens, so stolen copies are useless (tokenization)." },
  ],
  rounds: [
    { move: "An attacker sends specially crafted web requests to Harbor Bank's site. Its web-application firewall is misconfigured and lets them through to the server behind it.",
      works: ["A"], points: 10,
      why: "Reviewing the firewall's configuration (A) catches the setting that let these requests through. This is the customer's side of the line — the provider never touches it.",
      discuss: "The provider supplies the firewall service. Whose job is it to configure it correctly — and who gets blamed if it's wrong?" },
    { move: "Through the firewall, the attacker tricks the server into asking the cloud for its own temporary access keys — and the cloud hands them over.",
      works: ["C"], points: 10,
      why: "Locking the key cabinet (C) — the cloud's protected setting for that request — means the server can't be tricked into fetching its keys for an outsider. The provider offers the protection; the customer has to switch it on.",
      discuss: "The provider offered this protection, but it was optional. Is an optional security setting the provider's responsibility or the customer's?" },
    { move: "Those keys belong to the server's cloud role — and that role can list and read every storage bucket in the account, more than 700 of them.",
      works: ["B"], points: 10,
      why: "One key only (B): if the server's role could read only the storage it needed, stolen keys would open one bucket, not seven hundred.",
      discuss: "Why do teams give a server's role more access than it needs? Think about deadlines and 'just make it work.'" },
    { move: "Using the stolen keys from outside the bank, the attacker lists hundreds of buckets that this server has never touched before.",
      works: ["D"], points: 10,
      why: "An alarm on unusual cloud activity (D) flags a role suddenly listing hundreds of buckets it never uses. Detection is still the customer's job in IaaS.",
      discuss: "The cloud logs every request. Logging is easy — so why do so many organizations never look at those logs?" },
    { move: "Over a few days, the attacker copies millions of card-application records out of cloud storage.",
      works: ["E", "D"], points: 10,
      why: "Watching the data leaving (E) catches gigabytes of applications heading out; the activity alarm (D) should already be ringing. Either one could have cut the theft short.",
      discuss: "Once the data is copied, it's gone for good. What's the difference between catching this in an hour and catching it in four months?" },
    { move: "Among the stolen files: Social Security numbers and bank account numbers for customers.",
      works: ["F"], points: 20,
      why: "Scrambling the most sensitive fields (F) doesn't stop the theft — it makes the stolen copies worthless. It lowers the CONSEQUENCE, not the likelihood. Hardest to see coming — double points.",
      discuss: "Defenses A–E try to stop the attack. F assumes the attack will succeed. Why would a bank plan for losing?" },
  ],
  bonus: { prompt: "If Harbor Bank could add only ONE of the six defenses, which would you choose?", points: 10 },
  reveal:
    "This really happened. It was Capital One in 2019. A misconfigured web-application firewall in Capital One's own cloud setup let an attacker trick a server into handing over its cloud access keys. Those keys could read far more storage than the server needed, and the attacker copied data on about 100 million people in the U.S. and 6 million in Canada — including roughly 140,000 Social Security numbers and 80,000 bank account numbers. Most Social Security numbers were tokenized, which limited the damage. The cloud provider itself was never breached. Capital One learned of it from an outside tip, and a U.S. banking regulator fined it $80 million.",
  lessons: [
    ["Nobody hacked the cloud.", "Every failure sat on the customer's side of the shared-responsibility line — the firewall setting, the keys, the permissions (defenses A and C were missing)."],
    ["One role, too many keys.", "A server that needed one bucket could read 700. Least privilege would have shrunk the theft to almost nothing (defense B was missing)."],
    ["Nobody was watching.", "The unusual activity and the large downloads went unnoticed until someone outside the bank reported it (defenses D and E were missing)."],
    ["Planning for failure paid off.", "Tokenization protected most Social Security numbers. Defense F didn't prevent the breach — it limited the consequence."],
  ],
  debrief: [
    "Draw the responsibility line: which of the six defenses were Capital One's job, and which were the provider's?",
    "Sort the six into 'lowers likelihood' and 'lowers consequence.' Which side did Capital One get right?",
    "If you could fund only TWO of the six defenses, which two would you buy, and why?",
  ],
};
const PUBLIC_DEFENSES = GAME.defenses.map((d) => ({ id: d.id, name: d.name, desc: d.desc }));

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
    .map((p) => ({ name: p.name, score: p.score }))
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
  GAME.defenses.forEach((d) => (c[d.id] = 0));
  Object.values(room.players).forEach((p) => { if (p.answer && c[p.answer] != null) c[p.answer]++; });
  return c;
}
function publicState(room) {
  const st = {
    phase: room.phase,
    round: room.round,
    total: GAME.rounds.length,
    story: GAME.story,
    defenses: PUBLIC_DEFENSES,
    scoreboard: scoreboard(room),
    players: Object.values(room.players).map((p) => p.name),
    answered: answeredCount(room),
    playerCount: Object.keys(room.players).length,
  };
  st.timer = (room.phase === "round" || room.phase === "bonus") ? publicTimer(room) : null;
  if (room.phase === "round" || room.phase === "reveal") {
    const r = GAME.rounds[room.round];
    st.move = r.move; st.points = r.points;
  }
  if (room.phase === "bonus" || room.phase === "bonusReveal") {
    st.prompt = GAME.bonus.prompt; st.points = GAME.bonus.points;
  }
  if (room.phase === "reveal") {
    const r = GAME.rounds[room.round];
    st.works = r.works; st.why = r.why; st.counts = letterCounts(room); st.discuss = r.discuss;
  }
  if (room.phase === "results") {
    st.reveal = GAME.reveal; st.lessons = GAME.lessons; st.debrief = GAME.debrief;
  }
  return st;
}
function broadcast(pin) {
  const room = rooms[pin];
  if (!room) return;
  io.to(pin).emit("state", publicState(room));
  // personal line to each player
  Object.values(room.players).forEach((p) => {
    if (p.connected) io.to(p.socketId).emit("you", { name: p.name, score: p.score, answer: p.answer, place: placeOf(room, p) });
  });
}
function resetAnswers(room) {
  Object.values(room.players).forEach((p) => { p.answer = null; p.counted = false; });
}

/* ------------------------------- TIMER ---------------------------------- */
/* Each round runs a visible countdown (120 s; bonus 60 s). At zero, answers lock — but the
 * host still decides when to reveal, so discussion is never cut off. Once every connected
 * team has answered, the clock holds; it resumes if a team rejoins without an answer.
 * The host can pause/resume or add 30 s. */
const ROUND_SECONDS = Number(process.env.ROUND_SECONDS) || 120, BONUS_SECONDS = Number(process.env.BONUS_SECONDS) || 60, EXTEND_SECONDS = 30;
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
      room = rooms[pin] = { hostId: socket.id, hostKey: crypto.randomBytes(12).toString("hex"), phase: "lobby", round: 0, players: {} };
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
    // answers can be changed freely until the host reveals (reveal flips the phase)
    if (!GAME.defenses.some((d) => d.id === letter)) return;
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
    room.phase = "lobby"; room.round = 0; clearTimer(room);
    Object.values(room.players).forEach((p) => { p.score = 0; p.answer = null; p.counted = false; });
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
    if (!room || socket.id !== room.hostId || !room.timer) return;
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
server.listen(PORT, () => console.log("Stop the Breach: Cloud running on port " + PORT));
