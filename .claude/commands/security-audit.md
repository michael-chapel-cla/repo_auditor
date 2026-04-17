# /security-audit

Run a security audit on a repository or the current workspace.

**Usage:** `/security-audit owner/repo` or `/security-audit` (audits current workspace/)

## What I will do

Read `agents/claude/security-audit.md` and `docs/context/01-security.md`, then execute every check:

1. Read `.env` to get repo config and workspace path
2. If a repo is specified, clone/pull it to `workspace/{slug}/`; otherwise use `workspace/` or current dir
3. Run `npm audit --json` if `package.json` exists
4. Run `gitleaks detect` for hardcoded secrets
5. Run `semgrep --config .semgrep/ai-code-security.yml` for static patterns
6. Check each npm package against the npm registry (hallucinated package detection)
7. Read and analyze source files for: SQL injection, command injection, insecure randomness, JWT issues, XSS, path traversal, prompt injection
8. Write results to `reports/{slug}/{auditId}/security-results.json`
9. Print a severity-ranked findings summary

Target: $ARGUMENTS
