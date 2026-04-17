import { execFileSync } from "child_process";
import { writeFileSync } from "fs";

const WORKSPACE = process.argv[2] ?? "workspace/CLADevOps_web-api-documents-ai";
const OUT =
  process.argv[3] ??
  "reports/CLADevOps_web-api-documents-ai/8234f7fd-a816-4223-9ce6-4748d5009c48/contributors.json";
const REPO = process.argv[4] ?? "CLADevOps/web-api-documents-ai";

const raw = execFileSync(
  "git",
  ["-C", WORKSPACE, "log", "--format=%ae|%an|%H|%aI", "--numstat"],
  { encoding: "utf8" },
);

const contributors = new Map();
const lines = raw.split("\n");
let current = null;

for (const line of lines) {
  if (!line.trim()) {
    // blank lines separate commits; don't null out current here —
    // git puts a blank line between the header and the numstat block
    continue;
  }
  const parts = line.split("|");
  if (parts.length === 4 && parts[3]?.includes("T")) {
    // new commit header: reset current
    const [email, name, , date] = parts;
    if (/\[bot\]/.test(email)) {
      current = null;
      continue;
    }
    if (!contributors.has(email)) {
      contributors.set(email, {
        email,
        name,
        commits: 0,
        additions: 0,
        deletions: 0,
        firstCommitAt: date,
        lastCommitAt: date,
        isBot: false,
      });
    }
    current = contributors.get(email);
    current.commits++;
    if (date < current.firstCommitAt) current.firstCommitAt = date;
    if (date > current.lastCommitAt) current.lastCommitAt = date;
  } else if (current !== null) {
    const cols = line.split("\t");
    if (cols.length === 3) {
      current.additions += parseInt(cols[0]) || 0;
      current.deletions += parseInt(cols[1]) || 0;
    }
  }
}

const sorted = [...contributors.values()].sort((a, b) => b.commits - a.commits);

// Weekly commit timeline for last 26 weeks
const logDates = execFileSync(
  "git",
  ["-C", WORKSPACE, "log", "--format=%aI", "--since=26 weeks ago"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const weekMap = new Map();
for (const d of logDates) {
  const dt = new Date(d);
  const jan1 = new Date(dt.getFullYear(), 0, 1);
  const week = Math.ceil(((dt - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  const key = `${dt.getFullYear()}-W${String(week).padStart(2, "0")}`;
  weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
}
const commitTimeline = [...weekMap.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([week, commits]) => ({ week, commits }));

const output = {
  repoFullName: REPO,
  generatedAt: new Date().toISOString(),
  contributors: sorted,
  commitTimeline,
  totalCommits: sorted.reduce((s, c) => s + c.commits, 0),
  activeContributors: sorted.length,
};

writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`Written to ${OUT}`);
console.log(
  `Contributors: ${sorted.length} | Total commits: ${output.totalCommits}`,
);
sorted.forEach((c, i) =>
  console.log(
    `${i + 1}. ${c.name} <${c.email}> commits:${c.commits} +${c.additions}/-${c.deletions} last:${c.lastCommitAt}`,
  ),
);
