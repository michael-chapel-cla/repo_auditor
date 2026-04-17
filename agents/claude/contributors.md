# Contributors Agent

Gather contributor statistics for the repository at `$WORKSPACE`.
Write output to `$OUT_DIR/contributors.json`.

## Steps

### 1. Git log stats

```bash
git -C "$WORKSPACE" log \
  --format="%ae|%an|%H|%aI" \
  --numstat \
  2>/dev/null || true
```

Parse the output (format lines alternate with numstat lines). Aggregate by author email:

- `commits`: count of commit entries
- `additions`: sum of additions from numstat
- `deletions`: sum of deletions from numstat
- `firstCommitAt`: earliest commit date
- `lastCommitAt`: most recent commit date

Normalize bot emails (e.g., `*[bot]*` patterns → skip or mark as `isBot: true`).

### 2. GitHub API enrichment (via gh CLI)

```bash
REPO=$(basename $(git -C "$WORKSPACE" remote get-url origin) .git)
OWNER=$(dirname $(git -C "$WORKSPACE" remote get-url origin | sed 's|.*github.com/||'))

gh api "repos/$OWNER/$REPO/contributors?per_page=100" 2>/dev/null || true
```

Merge the GitHub API contributor data (which includes `contributions` count) with the git log data.

### 3. Commit timeline

Generate a weekly commit count for the last 26 weeks:

```bash
git -C "$WORKSPACE" log --format="%aI" --since="26 weeks ago" 2>/dev/null | \
  awk '{print substr($0,1,10)}' | \
  sort | uniq -c || true
```

Group by ISO week. Output as array of `{ week: "YYYY-Www", commits: N }`.

## Output format

Write to `$OUT_DIR/contributors.json`:

```json
{
  "repoFullName": "owner/repo",
  "generatedAt": "<ISO>",
  "contributors": [
    {
      "email": "...",
      "name": "...",
      "commits": 42,
      "additions": 1200,
      "deletions": 400,
      "firstCommitAt": "...",
      "lastCommitAt": "...",
      "isBot": false
    }
  ],
  "commitTimeline": [{ "week": "2026-W01", "commits": 12 }],
  "totalCommits": 0,
  "activeContributors": 0
}
```

Sort `contributors` by `commits` descending.
