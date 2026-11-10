"use strict";
/* Risk Desk: Silver Star Mines — ISI 315 Week 10. Content copied verbatim from ../risk-desk/server.js. */
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

module.exports = Object.assign({}, GAME, { ui: Object.assign({}, GAME.ui || {}, {"bonusTap": "Pick one. Any answer earns the bonus, so be ready to defend it."}) }, {
  "title": "Risk Desk: Silver Star Mines",
  "kicker": "Week 10 · Risk Analysis & Controls (Ch 14–15)",
  "blurb": "Rate, treat, and control Silver Star Mines' risks with the textbook's own tables.",
  "lobby": {
    "label": "The five treatments (Act 2)",
    "note": "Acts 1, 3, and 4 show their own choices on screen each round."
  },
  "id": "risk-desk",
  "week": "Week 10",
  "day": "",
  "order": 6
});
