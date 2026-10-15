"use strict";
/*
 * Stop the Breach — live classroom game server.
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
    "Northwind Retail runs 180 stores. Shoppers pay by credit card at the registers, and every card number lands in one big database. Northwind also hires ClimaCore, an outside company, to watch store heating and refrigeration — and ClimaCore logs in from outside to do it. One night, someone attacks.",
  defenses: [
    { id: "A", name: "Two-step login for the vendor", desc: "the vendor needs a second one-time code, not just a password." },
    { id: "B", name: "Give the vendor one key only", desc: "their login reaches the heating system and nothing else." },
    { id: "C", name: "Inside walls", desc: "the register network is walled off from the rest of the company." },
    { id: "D", name: "A network alarm", desc: "flags unusual activity — a burglar alarm for the network." },
    { id: "E", name: "A guard who responds", desc: "a person actually investigates when the alarm goes off." },
    { id: "F", name: "An exit checkpoint", desc: "watches data leaving the company and stops the unexpected." },
  ],
  rounds: [
    { move: "An attacker tricks a ClimaCore employee into handing over their login password.",
      works: ["A"], points: 10,
      why: "A two-step login (A) makes a stolen password useless on its own — the attacker still can't get in.",
      discuss: "Why can't any tool fully stop phishing? Whose job is a vendor's security — theirs or yours?" },
    { move: "Using that password, the attacker logs in as the vendor and starts roaming Northwind's network.",
      works: ["B", "C"], points: 10,
      why: "Give the vendor one key only (B), or wall off the network (C), and the attacker can't roam.",
      discuss: "Why do companies give outside vendors broad access in the first place? Convenience vs. security." },
    { move: "The attacker heads for the register (checkout) network.",
      works: ["C", "D"], points: 10,
      why: "Inside walls (C) should block the jump; the network alarm (D) should flag such an unusual move.",
      discuss: "The alarm detected this — is detecting enough if nobody acts on it?" },
    { move: "The attacker installs card-stealing software on the registers.",
      works: ["D", "E"], points: 10,
      why: "The alarm (D) catches brand-new software — but only if a guard (E) actually acts on it.",
      discuss: "Signature tools miss brand-new malware. How do you catch something no one has seen before?" },
    { move: "The software quietly sends the stolen card numbers out of the company.",
      works: ["E", "F"], points: 20,
      why: "An exit checkpoint (F) notices card data leaving; a guard (E) must respond. Hardest to catch — double points.",
      discuss: "Why is data leaving so much harder to catch than someone breaking in?" },
  ],
  bonus: { prompt: "If Northwind could add only ONE of the six defenses, which would you choose?", points: 10 },
  reveal:
    "This really happened. It was the Target breach of 2013. Attackers got in through a heating-and-refrigeration vendor's stolen login, crossed a network with no inside walls to the registers, stole about 40 million card numbers, and shipped them out.",
  lessons: [
    ["The alarm went off.", "Target DID detect it (defense D) — but nobody acted (defense E was missing). An alarm no one answers is useless."],
    ["No inside walls.", "Nothing stopped the jump from the vendor to the registers (defense C was missing)."],
    ["A trusted vendor was the door.", "The outsider's login was the way in (defenses A and B were missing)."],
  ],
  debrief: [
    "No single defense stopped everything — that's defense in depth. Why not just buy the one best firewall?",
    "Target had most of these tools and still lost. Tools vs. people and process — which really failed?",
    "If you had budget for only TWO of the six defenses, which two would you buy, and why?",
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
    defenses: PUBLIC_DEFENSES,
    scoreboard: scoreboard(room),
    players: Object.values(room.players).map((p) => p.name),
    answered: answeredCount(room),
    playerCount: Object.keys(room.players).length,
  };
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
    broadcast(pin);
  });

  socket.on("host:start", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId) return;
    room.phase = "round"; room.round = 0; resetAnswers(room);
    broadcast(socket.data.pin);
  });

  socket.on("player:answer", ({ letter }) => {
    const room = rooms[socket.data.pin];
    if (!room) return;
    const p = room.players[socket.data.token];
    if (!p) return;
    if (room.phase !== "round" && room.phase !== "bonus") return;
    // answers can be changed freely until the host reveals (reveal flips the phase)
    if (!GAME.defenses.some((d) => d.id === letter)) return;
    p.answer = letter;
    broadcast(socket.data.pin);
  });

  socket.on("host:reveal", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId) return;
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
        room.round += 1; room.phase = "round"; resetAnswers(room);
      } else {
        room.phase = "bonus"; resetAnswers(room);
      }
    } else if (room.phase === "bonusReveal") {
      room.phase = "results";
    }
    broadcast(socket.data.pin);
  });

  socket.on("host:restart", () => {
    const room = rooms[socket.data.pin];
    if (!room || socket.id !== room.hostId) return;
    room.phase = "lobby"; room.round = 0;
    Object.values(room.players).forEach((p) => { p.score = 0; p.answer = null; p.counted = false; });
    broadcast(socket.data.pin);
  });

  socket.on("disconnect", () => {
    const pin = socket.data.pin; const room = rooms[pin];
    if (!room) return;
    if (socket.data.role === "host" && socket.id === room.hostId) {
      // keep the game alive while the host's screen sleeps; close it only if they never come back
      clearTimeout(room.closeTimer);
      room.closeTimer = setTimeout(() => {
        if (rooms[pin] === room) { io.to(pin).emit("host:gone"); delete rooms[pin]; }
      }, HOST_GRACE_MS);
      return;
    }
    if (socket.data.role === "player") {
      const p = room.players[socket.data.token];
      if (p && p.socketId === socket.id) {
        if (room.phase === "lobby") delete room.players[socket.data.token]; // nothing to lose yet
        else p.connected = false;                                           // keep seat and score
        broadcast(pin);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Stop the Breach running on port " + PORT));
