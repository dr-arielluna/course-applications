"use strict";
/* Risk Ready — ISI 315 Week 9 · Thursday. Content copied verbatim from ../risk-ready/server.js. */
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

module.exports = Object.assign({}, GAME, { ui: Object.assign({}, GAME.ui || {}, {"bonusTap": "Pick one — any answer earns the bonus. Be ready to defend it."}) }, {
  "title": "Risk Ready",
  "kicker": "Week 9 · Thursday · Risk Assessment (§§14.1–14.3)",
  "blurb": "Name the risk, choose the lever (likelihood or consequence), pick the assessment approach.",
  "lobby": {
    "label": "The four approaches (Act 3)",
    "note": "Act 1 (Name it) and Act 2 (Which lever?) show their own choices on screen each round."
  },
  "id": "risk-ready",
  "week": "Week 9",
  "day": "Thursday",
  "order": 5
});
