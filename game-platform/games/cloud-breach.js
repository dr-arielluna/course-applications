"use strict";
/* Stop the Breach: Cloud & IoT — ISI 315 Week 9 · Tuesday. Content copied verbatim from ../cloud-breach/server.js. */
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

module.exports = Object.assign({}, GAME, { ui: Object.assign({}, GAME.ui || {}, {"bonusTap": "Pick one — any answer earns the bonus. Be ready to defend it."}) }, {
  "title": "Stop the Breach: Cloud & IoT",
  "kicker": "Week 9 · Tuesday · Cloud & IoT Security",
  "blurb": "Two acts: Capital One 2019 in the cloud, then a Mirai-style botnet on a smart campus.",
  "lobby": {
    "label": "Act 1 defenses (Act 2 brings its own six on screen)",
    "note": "Act 1 is the cloud (rounds 1–5); Act 2 is the smart campus (rounds 6–10)."
  },
  "id": "cloud-breach",
  "week": "Week 9",
  "day": "Tuesday",
  "order": 4
});
