"use strict";
/* Stop the Breach — ISI 315 Week 6. Content copied verbatim from ../stop-the-breach/server.js. */
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

module.exports = Object.assign({}, GAME, {
  "title": "Stop the Breach",
  "kicker": "Week 6 · Detection & Firewalls",
  "blurb": "Target 2013: pick the defense that stops each move of a real breach.",
  "champion": "Breach Busters",
  "revealTitle": "The reveal",
  "lessonsTitle": "Why Target lost",
  "ui": {
    "choosing": "Students are choosing a defense on their devices…",
    "tap": "Tap the defense that stops this.",
    "right": "works!",
    "wrong": "wouldn't stop this",
    "bonusTap": "Pick the one you'd add first."
  },
  "lobby": {
    "label": "The six defenses",
    "note": ""
  },
  "id": "stop-the-breach",
  "week": "Week 6",
  "day": "",
  "order": 1
});
