"use strict";
/* Risk Desk: The Web Design Company — ISI 315 Week 10 (alternate scenario to Silver Star Mines). */
/* Week 10 — Chapter 14 §§14.4–14.5 and Chapter 15, through the small web design company of
   textbook Problems 14.4, 15.3, and 17.9 (the same company students analyze in Case 2 and Lab 2).
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
    "You've been hired as the security analyst for a small web design company: twelve staff who design and host websites for local businesses. Its own public website is how it wins new clients. Client project files (designs, contracts, and the logins to clients' sites) sit on an office file server, and staff work from laptops in the office and at home. Management will accept only Medium or lower risks. Act 1: Rate each risk with the risk matrix shown on screen. Act 2: Choose how to treat it. Act 3: Classify the controls. Act 4: Choose and keep the controls working. Every round the class gets wrong, a risk goes unmanaged, so watch the meters.",
  roundSeconds: 90,
  ui: { choosing: "Teams are deciding on their devices…", tap: "Tap your answer.", right: "is right!", wrong: "isn't right" },
  meters: [
    { id: "downtime", label: "Website downtime (est.)", unit: "hours" },
    { id: "losses", label: "Lost business & costs (est.)", unit: "$" },
  ],
  defenses: [
    { id: "A", name: "Accept", desc: "management takes the risk on for business reasons and owns the consequences." },
    { id: "B", name: "Avoid", desc: "don't do the activity or run the system that creates the risk." },
    { id: "C", name: "Transfer", desc: "share the risk with a third party (insurance, a contract, a partner)." },
    { id: "D", name: "Reduce consequence", desc: "limit the damage if it happens (backups, recovery plans, replication)." },
    { id: "E", name: "Reduce likelihood", desc: "make it less likely to happen (firewalls, access tokens, password rules)." },
  ],
  rounds: [
    { act: "Act 1 · Rate the risk", choices: LEVELS, move: "Using the risk matrix, what is the level of risk?", facts: [{"label": "Asset", "value": "The company's own web server"}, {"label": "Threat", "value": "Hacking and defacement"}, {"label": "Existing controls", "value": "Admin password; content-management system not updated in a year"}, {"label": "Likelihood", "value": "Likely", "note": "the site was defaced once two years ago"}, {"label": "Consequence", "value": "Moderate", "note": "site down for days, and clients notice"}],
      reference: RISK_MATRIX, works: ["C"], points: 10, impact: { meter: "downtime", amount: 72 },
      why: "Likely × Moderate = High. The earlier defacement matters: a rating of Likely needs evidence that the threat has happened before, and here it has.",
      discuss: "The site is the company's main way to win clients. Should that push the consequence higher than Moderate? What would change the rating?" },
    { act: "Act 1 · Rate the risk", choices: LEVELS, move: "Using the risk matrix, what is the level of risk?", facts: [{"label": "Asset", "value": "Client project files on the office file server, including the logins to clients' websites"}, {"label": "Threat", "value": "Ransomware arriving in an email attachment"}, {"label": "Existing controls", "value": "Antivirus; a nightly backup to an external drive that stays plugged in"}, {"label": "Likelihood", "value": "Possible"}, {"label": "Consequence", "value": "Major", "note": "weeks to recover, missed deadlines, client logins exposed"}],
      reference: RISK_MATRIX, works: ["D"], points: 10, impact: { meter: "losses", amount: 120000 },
      why: "Possible × Major = Extreme. The backup doesn't lower the consequence much: a drive left plugged in gets encrypted along with everything else.",
      discuss: "One small change to the existing backup would lower the consequence. What is it?" },
    { act: "Act 1 · Rate the risk", choices: LEVELS, move: "Using the risk matrix, what is the level of risk?", facts: [{"label": "Asset", "value": "The domain-name account (controls the website address and email)"}, {"label": "Threat", "value": "Someone takes over the account"}, {"label": "Existing controls", "value": "Strong password"}, {"label": "Likelihood", "value": "Rare"}, {"label": "Consequence", "value": "Catastrophic", "note": "the whole business offline for months"}],
      reference: RISK_MATRIX, works: ["C"], points: 20, impact: { meter: "downtime", amount: 720 },
      why: "Rare × Catastrophic = High. A rare event still needs management's attention when the consequence would end the business. End of Act 1: double points.",
      discuss: "Most small businesses never think about their domain account. Who at this company would even know its password?" },
    { act: "Act 2 · Treat the risk", move: "The company moves its own website to a managed hosting provider. The contract makes the provider responsible for patching and restoring the server, and pays the company a credit for every hour the site is down.",
      works: ["C"], points: 10, impact: { meter: "downtime", amount: 48 },
      why: "Risk transfer: sharing responsibility with a third party through a contract. The risk still exists; the provider now carries part of it, and pays when it fails.",
      discuss: "The provider pays a credit for downtime. Does that credit cover the clients the company loses while its site is defaced?" },
    { act: "Act 2 · Treat the risk", move: "The company turns on automatic updates for its content-management system and puts the site behind a web-application firewall.",
      works: ["E"], points: 10, impact: { meter: "downtime", amount: 48 },
      why: "Reduce likelihood: closing the known weaknesses (an outdated system, unfiltered traffic) makes a successful attack less likely. The damage would be the same if one still succeeded.",
      discuss: "Automatic updates can break a website. Who should decide whether that risk is worth it?" },
    { act: "Act 2 · Treat the risk", move: "The company keeps a clean, tested copy of its whole website that it can republish within an hour of any defacement.",
      works: ["D"], points: 10, impact: { meter: "downtime", amount: 24 },
      why: "Reduce consequence: an attack is just as likely, but the site is back in an hour instead of days. A copy you've tested is what makes the recovery dependable.",
      discuss: "Why does the copy need to be tested, not just saved?" },
    { act: "Act 2 · Treat the risk", move: "The company decides to stop hosting clients' websites on its own server and refers clients to professional hosting providers instead, because it can't afford to secure them properly.",
      works: ["B"], points: 20, impact: { meter: "losses", amount: 60000 },
      why: "Risk avoidance: no longer doing the activity that creates the risk. The trade-off is a lost service and its income. End of Act 2: double points.",
      discuss: "Hosting brought in steady monthly income. When is giving up a service the right security decision?" },
    { act: "Act 3 · Pick the control class", choices: CLASSES, move: "The owner adopts a written security policy, names one senior designer as security lead, and schedules a yearly risk review.",
      works: ["A"], points: 10, impact: { meter: "losses", amount: 30000 },
      why: "Management controls: policy, planning, assigned responsibility, and risk assessment: the decisions that guide every other control.",
      discuss: "In a twelve-person company, the security lead is also a full-time designer. What could go wrong?" },
    { act: "Act 3 · Pick the control class", choices: CLASSES, move: "Every quarter, staff complete a short training on spotting phishing emails, and the backup drive is now unplugged each morning and kept in a locked cabinet off site.",
      works: ["B"], points: 10, impact: { meter: "losses", amount: 50000 },
      why: "Operational controls: carried out mainly by people: awareness training, and a backup routine that includes handling and storing the media safely.",
      discuss: "Both controls depend on someone remembering. How would you make sure they actually happen every time?" },
    { act: "Act 3 · Pick the control class", choices: CLASSES, move: "The web server now requires two-step login for the site administrator and records every change an administrator makes.",
      works: ["C"], points: 20, impact: { meter: "downtime", amount: 48 },
      why: "Technical controls: hardware and software security capabilities: identification and authentication, and audit logging. End of Act 3: double points.",
      discuss: "A log that nobody reads protects no one. What procedure does this control need to go with it?" },
    { act: "Act 4 · Choose and keep the controls", choices: CHOOSE, move: "A $3,000-a-year managed security service would lower the defacement risk from High to Low. It's the cheapest option that does so.",
      works: ["A"], points: 10, impact: { meter: "downtime", amount: 72 },
      why: "If a control reduces the risk enough and is the most cost-effective option, use it.",
      discuss: "How would you explain this $3,000 to an owner who has never been breached?" },
    { act: "Act 4 · Choose and keep the controls", choices: FOLLOW, move: "Six months later, the security lead reviews the firewall's rules and log reports to confirm the controls still work, and checks for newly announced weaknesses in the content-management system.",
      works: ["A"], points: 10, impact: { meter: "downtime", amount: 48 },
      why: "Maintenance: periodically reviewing controls to confirm they still work as intended, upgrading them when new requirements or weaknesses appear, and reading the logs.",
      discuss: "This is the step organizations most often skip. Why does it get forgotten?" },
    { act: "Act 4 · Choose and keep the controls", choices: CHOOSE, move: "The ransomware risk is rated Extreme. A proposed email filter would lower it only to High, and management accepts only Medium or lower.",
      works: ["D"], points: 20, impact: { meter: "losses", amount: 120000 },
      why: "If a control doesn't reduce the risk enough, use more or different controls. Pairing the filter with tested, offline backups lowers both the likelihood and the consequence. Final round: double points.",
      discuss: "Which second control would bring this risk down to Medium most cheaply?" },
  ],
  bonus: { prompt: "The ransomware risk to client files is rated Extreme. Which ONE treatment would you lead with?", points: 10,
           note: "Any answer earns the points. Most analysts lead with reducing the consequence: tested backups kept offline mean ransomware becomes an inconvenience, not a disaster. Reducing the likelihood (email filtering, phishing training) is the natural second step." },
  champion: "Risk Masters",
  revealTitle: "What you just did, and what comes next",
  reveal:
    "You took the web design company through the full process from Chapters 14 and 15: rating each risk from its likelihood and consequence, choosing a treatment that fits management's risk appetite, classifying the controls, and keeping them working. This is the same company you'll meet again in Case Analysis 2 and Lab 2. There, its web server is hacked and defaced (textbook Problem 17.9), and you'll decide how it responds, using the risk register you just built as your starting point.",
  lessonsTitle: "Four rules to keep",
  lessons: [
    ["A rare risk can still need attention.", "Severe enough consequences keep a Rare risk at High, like losing the domain account."],
    ["There are five ways to treat a risk.", "Accept, avoid, transfer, reduce consequence, or reduce likelihood. Acceptance is a management decision, made in writing."],
    ["Controls come in three classes.", "Management (policy and planning), operational (people and procedures), technical (hardware and software)."],
    ["The cycle never ends.", "Maintenance, compliance checking, change and configuration management, and incident handling keep the chosen risk level from drifting."],
  ],
  debrief: [
    "Which risk on this company's register would you treat first, and why: the highest-rated one, or the cheapest to fix?",
    "In Case 2, this company's web server is defaced. Which control from today would have helped most?",
    "For your project organization: what's your Extreme or High risk, and which treatment will you recommend?",
  ],
  debriefKey: "Treat first: often the cheap High risk (automatic updates plus a web-application firewall for the defacement risk) before the expensive Extreme one; the book's Table 14.5 example makes the same call. For Case 2: the tested clean copy of the site (reduce consequence) and the managed hosting contract (transfer) both change how it responds.",
};

module.exports = Object.assign({}, GAME, { ui: Object.assign({}, GAME.ui || {}, {"bonusTap": "Pick one. Any answer earns the bonus, so be ready to defend it."}) }, {
  "title": "Risk Desk: The Web Design Company",
  "kicker": "Week 10 · Risk Analysis & Controls (Ch 14–15)",
  "blurb": "The company from Case 2: rate, treat, and control its risks before its web server is attacked.",
  "lobby": { "label": "The five treatments (Act 2)", "note": "Acts 1, 3, and 4 show their own choices on screen each round." },
  "id": "risk-desk-web",
  "week": "Week 10",
  "day": "Alternate",
  "order": 7
});
