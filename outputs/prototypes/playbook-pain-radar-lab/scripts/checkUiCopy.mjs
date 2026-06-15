import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = ["index.html", "src/App.jsx"].map((file) => resolve(file));

const forbiddenVisibleCopy = [
  "Melwater Analyst Lab",
  "Playbook Analyst Lab",
  "Pain Radar",
  "Search Quality Lab",
  "Product Pain Radar",
  "Action Closed Loop",
  "Data Quality Overview",
  "Competitor Battlecards",
  "Content Opportunity Lab",
  "User Voice Quote Library",
  "Concept Candidate Lab",
  "Crisis Response Watchtower",
  "Region Language Priority",
  "Executive Monthly Brief",
  "Review Audit Log",
  "Ops Status & Access",
  "Weekly Action Review",
  "Quote Library",
  "Monthly Board Pack",
  "Board Narrative",
  "Review Event History",
];

const findings = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const phrase of forbiddenVisibleCopy) {
    if (content.includes(phrase)) {
      findings.push(`${file}: contains "${phrase}"`);
    }
  }
}

if (findings.length > 0) {
  console.error("UI copy check failed. Replace legacy English product labels with Chinese business copy:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(
  "UI copy check passed. Technical terms such as API, VOC, marts, query, owner, token, review-state, document_id, occurrence_id, and MELWATER_RELEASE_REF remain allowed."
);
