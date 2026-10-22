"use strict";
/*
 * Stop the Breach: Checkout — live classroom game server (ISI 315 Week 8).
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
    "SkyLine Airways sells tickets on its website and app. At checkout, customers type their name, card number, expiry date, and security code. The checkout page runs a few small JavaScript programs in each customer's browser — some written by SkyLine, some borrowed from outside libraries. A baggage-handling partner also has remote login access to SkyLine's systems. One summer, someone attacks — and the attack runs for two weeks.",
  defenses: [
    { id: "A", name: "Two-step login for partners", desc: "a partner's login needs a one-time code, not just a password." },
    { id: "B", name: "Lock up the admin passwords", desc: "admin passwords live in a protected vault — never typed into files or scripts." },
    { id: "C", name: "File-change alarm", desc: "alerts the team the moment a website file changes without an approved release." },
    { id: "D", name: "Script fingerprint check", desc: "browsers refuse to run a script that doesn't match its known fingerprint (Subresource Integrity)." },
    { id: "E", name: "Approved-destinations list", desc: "the page may only load scripts from, and send data to, approved addresses (Content Security Policy)." },
    { id: "F", name: "Treat typed text as text", desc: "anything a user types is encoded on output, so it is shown — never run (output encoding)." },
  ],
  rounds: [
    { move: "An attacker gets the password of a staff member at the baggage partner and uses it to log in remotely.",
      works: ["A"], points: 10,
      why: "A two-step login (A) makes a stolen password useless on its own — the attacker still can't get in.",
      discuss: "The partner's staff member wasn't SkyLine's employee. Whose job was it to require a second step?" },
    { move: "Inside, the attacker searches shared files and finds an administrator's password typed in plain text.",
      works: ["B"], points: 10,
      why: "If admin passwords live only in a protected vault (B), there is nothing lying around to find.",
      discuss: "Why do busy IT teams end up writing passwords into files and scripts? What makes the safe way easier?" },
    { move: "Now acting as an administrator, the attacker quietly adds 22 lines of code to a JavaScript file the checkout page loads.",
      works: ["C"], points: 10,
      why: "A file-change alarm (C) should fire the moment a live checkout script changes without an approved release.",
      discuss: "Twenty-two lines in a big website. How would you even know a file changed — and who should get the alert?" },
    { move: "Meanwhile, a copycat tries a different trick: typing a script into the booking form's 'special requests' box, hoping it runs on staff screens.",
      works: ["F", "E"], points: 10,
      why: "That's cross-site scripting. Encoding output (F) displays the script as harmless text; an approved-destinations list (E) stops it calling home. Filtering input alone is easy to sneak past — the fix belongs on output.",
      discuss: "Why not just block the < and > characters on the way in? Think of a real customer that would break." },
    { move: "Customers open the checkout page. Their browsers download the changed script and run it.",
      works: ["D"], points: 10,
      why: "A fingerprint check (D) makes the browser refuse a script that no longer matches — so the edited code never runs.",
      discuss: "The browser did exactly what the page told it to. Is the browser wrong, or the page?" },
    { move: "As customers type, the script copies their card details and sends them to a look-alike web address the attacker registered — complete with a padlock icon.",
      works: ["E"], points: 20,
      why: "An approved-destinations list (E) blocks the data from going anywhere new. The padlock only means the connection is encrypted, not that the site is legitimate. Hardest to catch — double points.",
      discuss: "Customers saw a padlock. What does the padlock actually promise — and what doesn't it?" },
  ],
  bonus: { prompt: "If SkyLine could add only ONE of the six defenses, which would you choose?", points: 10 },
  reveal:
    "This really happened. It was British Airways in 2018. Attackers logged in with a stolen account belonging to a staff member at a baggage-handling partner — the remote-access system didn't ask for a second step. Inside, they found an administrator password stored in plain text, then changed a JavaScript file used on BA's payment pages. For about two weeks (21 Aug – 5 Sep 2018), card details typed into BA's website and app were sent to a look-alike site, baways.com. About 429,000 customers and staff were affected, and the UK data regulator (the ICO) fined BA £20 million.",
  lessons: [
    ["One partner login, no second step.", "A stolen password was all it took to get in (defense A was missing)."],
    ["The keys were lying around.", "An admin password in plain text turned a small break-in into full control (defense B was missing)."],
    ["Nobody noticed the change.", "The edited script ran for about two weeks; BA learned of it from an outside party, not its own monitoring (defense C was missing)."],
    ["The browser ran whatever it was given.", "Nothing checked the script's fingerprint or limited where it could send data (defenses D and E were missing). Same lesson as XSS: the fix belongs where output reaches the browser."],
  ],
  debrief: [
    "Tuesday's point: XSS is an output failure, not an input failure. Where did output go wrong in the BA attack?",
    "Defenses A–C protect the server; D–F protect the customer's browser. Which side did BA neglect more?",
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
  return Object.values(room.players)
    .map((p) => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
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
    if (p.connected) io.to(p.socketId).emit("you", { name: p.name, score: p.score, answer: p.answer });
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
server.listen(PORT, () => console.log("Stop the Breach: Checkout running on port " + PORT));
