"use strict";
/*
 * Who Regulates You? — live classroom game server (ISI 315 Week 7).
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
const BEYOND = [
    { id: "A", name: "HIPAA", desc: "health information." },
    { id: "B", name: "GLBA", desc: "customer financial information." },
    { id: "C", name: "PCI DSS", desc: "payment card data." },
    { id: "D", name: "SOX", desc: "public companies' financial reporting and internal controls." },
    { id: "E", name: "FERPA", desc: "student education records." },
    { id: "F", name: "GDPR", desc: "personal data of people in the EU." },
  ];
/* "defenses" are the six answer choices (kept as the field name the pages read). */
const GAME = {
  story:
    "You're a new compliance analyst. Each round, a real kind of organization walks through the door. Your job: decide which rule governs its security. Start with the type of data it holds, then the sector it works in and who it handles that data for. The last four rounds go beyond the big three.",
  defenses: [
    { id: "A", name: "HIPAA", desc: "health information, handled by a provider, health plan, or their vendor." },
    { id: "B", name: "GLBA", desc: "customers' financial information at a \"financial institution\"." },
    { id: "C", name: "PCI DSS", desc: "payment card numbers that are stored, processed, or sent." },
    { id: "D", name: "HIPAA + PCI DSS", desc: "health information and payment cards." },
    { id: "E", name: "GLBA + PCI DSS", desc: "financial information and payment cards." },
    { id: "F", name: "None of the three", desc: "no HIPAA, GLBA, or PCI data. The NIST framework is voluntary." },
  ],
  /* "lesson" is shown on the host screen only: the objective practiced, the deck slides it
     ties to, and what to listen for in the discussion. Slide numbers match ISI315-Week07-Deck. */
  rounds: [
    { move: "A small dental practice bills patients' insurance electronically and takes credit cards at the front desk.",
      works: ["D"], points: 10,
      why: "D. Billing insurance electronically makes the practice a HIPAA covered entity: federal law, enforced by HHS. Taking cards adds PCI DSS: a contract with its bank, enforced by the bank and the card brands.",
      discuss: "Same office, two rules. Which one is a law and which is a contract, and what happens when the office breaks each one?",
      lesson: "Objectives 1 and 3 · Slides 18, 20, 23 · Listen for: HHS fines and corrective action vs. the bank raising fees or cutting off card processing." },
    { move: "CSI's financial aid office collects students' tax returns and family income to award aid.",
      works: ["B"], points: 10,
      why: "B. Student aid records are customer financial information, and the FTC treats colleges as financial institutions under the GLBA Safeguards Rule: federal law, enforced by the FTC.",
      discuss: "GLBA makes CSI name one \"Qualified Individual\" accountable for its security program. Which NIST CSF function is that: Protect, or Govern?",
      lesson: "Objectives 2 and 3 · Slides 10, 12, 19 · Answer: Govern (GV.RR, roles and responsibilities). Accountability is exactly what Govern added in CSF 2.0." },
    { move: "A cloud company stores patient records for a hospital. It never treats a single patient.",
      works: ["A"], points: 10,
      why: "A. It handles patient records on a covered entity's behalf, which makes it a HIPAA business associate, bound by a business associate agreement. HHS enforces.",
      discuss: "Last week, Target was breached through its heating vendor. Which Govern category is about managing the risk your vendors bring?",
      lesson: "Objectives 2 and 3 · Slides 12, 18 · Answer: GV.SC, cybersecurity supply chain risk management." },
    { move: "A car dealership arranges auto loans for buyers and takes card payments in its service department.",
      works: ["E"], points: 10,
      why: "E. Arranging car loans makes the dealer a financial institution under the GLBA Safeguards Rule (the FTC enforces). Card payments in the service department add PCI DSS (the bank enforces).",
      discuss: "The dealer must encrypt customer data. GLBA and PCI DSS both REQUIRE it. If this were the dental office instead, how would HIPAA label encryption?",
      lesson: "Objective 4 · Slides 19, 20, 24 · Answer: ADDRESSABLE. Not optional: implement it, or document why not and use an equivalent. Same control, different mandate strengths." },
    { move: "A free mobile game studio, with no in-app purchases, collects players' email addresses.",
      works: ["F"], points: 10,
      why: "F. No health records, no financial accounts, no cards, so none of the three applies. State breach-notification laws and the FTC still do.",
      discuss: "With no rule to follow, the studio decides to adopt the NIST CSF. Can it become \"NIST CSF certified\"? Why or why not?",
      lesson: "Objective 1 · Slides 5, 6 · Answer: No. The CSF is a framework of outcomes, not a certifiable standard. ISO 27001 is certifiable; PCI DSS is validated." },
    { move: "A fitness app tracks users' heart rate and sleep. People buy it directly and pay a monthly subscription by card.",
      works: ["C"], points: 20,
      why: "C. Only PCI DSS. HIPAA covers providers, health plans, and their vendors, not an app sold straight to consumers. The data feels medical, but HIPAA turns on who holds it, not how sensitive it is. The trap round: double points.",
      discuss: "Heart-rate data feels like health data. Should HIPAA cover this app? What protects that data today?",
      lesson: "Objective 3 · Slides 18, 21 · Listen for: covered-entity status, not how sensitive the data is, triggers HIPAA." },
    /* Beyond the big three: these rounds use their own choices (SOX, FERPA, GDPR, due care). */
    { move: "Beyond the big three. A publicly traded company's CEO and CFO must personally certify that its financial reports are accurate, backed by tested internal controls.",
      choices: BEYOND, works: ["D"], points: 10,
      why: "D. Sarbanes-Oxley (SOX), 2002, enforced by the SEC. It's about the integrity of financial reporting at public companies, and IT security matters because those reports run on IT systems.",
      discuss: "SOX was passed after the Enron scandal. Why would a law about accounting end up on a security team's desk?",
      lesson: "Quiz Q19 · Not on the slides · SOX: financial reporting integrity and internal controls at public companies; SEC enforces." },
    { move: "CSI's registrar keeps every student's grades, transcripts, and class schedule.",
      choices: BEYOND, works: ["E"], points: 10,
      why: "E. FERPA, the Family Educational Rights and Privacy Act, protects student education records at schools that receive federal funding. The U.S. Department of Education enforces it.",
      discuss: "CSI's financial aid office falls under GLBA, and its registrar under FERPA. What does that tell you about scoping one organization?",
      lesson: "Quiz Q28 (and Q12) · Not on the slides · FERPA: student education records; Dept. of Education enforces. Ties back to round 2." },
    { move: "A Staten Island online shop ships to customers in France and Germany and keeps their names, emails, and home addresses.",
      choices: BEYOND, works: ["F"], points: 10,
      why: "F. The GDPR protects personal data of people in the EU, wherever the company handling it is based. That's your textbook's Chapter 19, which we reach in Week 12.",
      discuss: "A U.S. shop answering to a European law: how can the EU enforce that, and why would the shop comply anyway?",
      lesson: "Quiz Q20 · Textbook Ch. 19 GDPR section · GDPR: personal data of EU residents, applies regardless of where the company is." },
    { move: "The company patches its servers every month, the reasonable step any prudent company takes. Then it audits whether the patches actually installed. Which one is the monthly patching?",
      choices: [
        { id: "A", name: "Due care", desc: "taking the reasonable steps a prudent organization would take." },
        { id: "B", name: "Due diligence", desc: "checking and verifying that those steps are actually working." },
      ],
      works: ["A"], points: 10,
      why: "A. Due care is doing the reasonable thing: patching. Due diligence is verifying it worked: the audit. Courts and regulators ask whether you did both.",
      discuss: "Target had alarms (due care). What was missing on the due diligence side?",
      lesson: "Quiz Q23 and Q24 · Not on the slides · Due care = reasonable steps a prudent org takes; due diligence = verifying they work." },
  ],
  bonus: {
    prompt: "A hospital also runs a gift shop that takes cards. If it could build its security program around only ONE of these, which should be the backbone?",
    points: 10,
    note: "Any answer earns the points. The strongest case is F: build one program on a framework like the NIST CSF, then map HIPAA and PCI DSS onto it, one control serving many rules. That's the live mapping we did on the board.",
  },
  champion: "Compliance Champions",
  revealTitle: "The twist",
  reveal:
    "Remember Target from last week's game? In September 2013 an assessor certified Target as PCI DSS compliant. Two months later, attackers stole about 40 million card numbers. Target was compliant, and it was still breached.",
  lessonsTitle: "What today's lesson says",
  lessons: [
    ["Regulation, standard, or framework?", "HIPAA and GLBA are law, enforced by HHS and the FTC. PCI DSS is a standard you're bound to by contract. The NIST CSF is a voluntary framework, and nobody can certify you against it."],
    ["Data first, then sector.", "To find the rule, identify the type of data an organization holds and the sector it operates in, then check whose behalf it handles that data on."],
    ["Someone has to own it.", "Every rule demands a named, accountable owner. In NIST CSF 2.0 that's Govern, the function that wraps around the other five."],
    ["Compliance is a floor, not a ceiling.", "Passing an assessment proves the minimum on the day it was checked. Target proved it."],
  ],
  debrief: [
    "Map MFA the way we mapped encryption: which CSF function is it, and which of HIPAA, GLBA, and PCI DSS actually requires it?",
    "Target was compliant and its alarm went off, yet nobody acted. Which CSF function failed, and why is that a Govern problem too?",
    "Your course project: which rule governs your organization, what data triggers it, and who enforces it?",
  ],
  debriefKey: "MFA: Protect (PR.AA). GLBA REQUIRES it (§314.4(c)(5)), PCI DSS requires it (Req. 8), HIPAA has no explicit MFA mandate. Target: Respond failed (RS); Govern owns who is accountable for acting on alerts.",
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
  };
  st.timer = (room.phase === "round" || room.phase === "bonus") ? publicTimer(room) : null;
  if (room.phase === "round" || room.phase === "reveal") {
    const r = GAME.rounds[room.round];
    st.move = r.move; st.points = r.points; st.customChoices = !!r.choices;
  }
  if (room.phase === "bonus" || room.phase === "bonusReveal") {
    st.prompt = GAME.bonus.prompt; st.points = GAME.bonus.points;
    if (room.phase === "bonusReveal") st.note = GAME.bonus.note;
  }
  if (room.phase === "reveal") {
    const r = GAME.rounds[room.round];
    st.works = r.works; st.why = r.why; st.counts = letterCounts(room); st.discuss = r.discuss; st.lesson = r.lesson;
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
server.listen(PORT, () => console.log("Who Regulates You? running on port " + PORT));
