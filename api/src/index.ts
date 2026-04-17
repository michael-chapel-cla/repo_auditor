/**
 * Minimal static file server for the frontend viewer.
 * Serves reports/ as static JSON + the frontend build.
 * No audit logic lives here — audits are run by Claude/Codex/Copilot agents.
 */
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const REPORTS_DIR = process.env["REPORTS_DIR"] ?? path.join(PROJECT_ROOT, "reports");
const FRONTEND_DIST = path.join(PROJECT_ROOT, "frontend", "dist");
const PORT = parseInt(process.env["API_PORT"] ?? "4000", 10);

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".html": "text/html",
  ".md": "text/markdown",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function safeJoin(base: string, rel: string): string | null {
  const resolved = path.resolve(base, rel.replace(/^\/+/, ""));
  return resolved.startsWith(base) ? resolved : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS headers for dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  try {
    // GET /api/reports — list all audit results
    if (pathname === "/api/reports") {
      const repoDirs = await readdir(REPORTS_DIR).catch(() => [] as string[]);
      const results = [];
      for (const repoDir of repoDirs) {
        if (repoDir === ".gitkeep") continue;
        const auditDirs = await readdir(path.join(REPORTS_DIR, repoDir)).catch(() => [] as string[]);
        for (const auditId of auditDirs) {
          const jsonPath = path.join(REPORTS_DIR, repoDir, auditId, "results.json");
          try {
            const raw = await readFile(jsonPath, "utf8");
            const data = JSON.parse(raw) as { repoFullName?: string; startedAt?: string; summary?: unknown; agentTool?: string };
            results.push({ auditId, repoFullName: data.repoFullName, startedAt: data.startedAt, summary: data.summary, agentTool: data.agentTool });
          } catch { /* skip */ }
        }
      }
      results.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results }));
      return;
    }

    // GET /api/contributors — latest contributor stats per repo
    if (pathname === "/api/contributors") {
      const repoParam = url.searchParams.get("repo");
      const repoDirs = await readdir(REPORTS_DIR).catch(() => [] as string[]);
      const out: unknown[] = [];
      for (const repoDir of repoDirs) {
        if (repoDir === ".gitkeep") continue;
        if (repoParam && repoDir !== repoParam.replace("/", "_")) continue;
        const auditDirs = await readdir(path.join(REPORTS_DIR, repoDir)).catch(() => [] as string[]);
        auditDirs.sort((a, b) => b.localeCompare(a));
        for (const auditId of auditDirs) {
          const jsonPath = path.join(REPORTS_DIR, repoDir, auditId, "results.json");
          try {
            const raw = await readFile(jsonPath, "utf8");
            const data = JSON.parse(raw) as { repoFullName?: string; contributors?: unknown[] };
            if (data.contributors?.length) {
              out.push({ repoFullName: data.repoFullName, contributors: data.contributors });
              break;
            }
          } catch { /* skip */ }
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results: out }));
      return;
    }

    // GET /api/reports/:auditId — full result JSON
    const auditMatch = pathname.match(/^\/api\/reports\/([^/]+)$/);
    if (auditMatch) {
      const auditId = auditMatch[1]!;
      const repoDirs = await readdir(REPORTS_DIR).catch(() => [] as string[]);
      for (const repoDir of repoDirs) {
        const jsonPath = path.join(REPORTS_DIR, repoDir, auditId, "results.json");
        try {
          const raw = await readFile(jsonPath, "utf8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(raw);
          return;
        } catch { /* try next */ }
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: `Audit not found: ${auditId}` } }));
      return;
    }

    // GET /api/reports/:auditId/report.(md|html) — report download
    const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)\/(report\.(md|html))$/);
    if (reportMatch) {
      const [, auditId, fileName, ext] = reportMatch as [string, string, string, string];
      const repoDirs = await readdir(REPORTS_DIR).catch(() => [] as string[]);
      for (const repoDir of repoDirs) {
        const filePath = path.join(REPORTS_DIR, repoDir, auditId, fileName);
        try {
          const content = await readFile(filePath, "utf8");
          res.writeHead(200, { "Content-Type": MIME[`.${ext}`] ?? "text/plain" });
          res.end(content);
          return;
        } catch { /* try next */ }
      }
      res.writeHead(404); res.end("Not found");
      return;
    }

    // Serve frontend static files
    let filePath = pathname === "/" ? "/index.html" : pathname;
    const safePath = safeJoin(FRONTEND_DIST, filePath);
    if (!safePath) { res.writeHead(400); res.end("Bad request"); return; }

    try {
      const s = await stat(safePath);
      if (s.isDirectory()) filePath = path.join(safePath, "index.html");
    } catch {
      // SPA fallback
      filePath = path.join(FRONTEND_DIST, "index.html");
    }

    const content = await readFile(typeof filePath === "string" && filePath.startsWith("/") ? filePath : safePath);
    const ext = path.extname(typeof filePath === "string" ? filePath : safePath);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(content);

  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }));
  }
});

server.listen(PORT, () => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", message: `Report viewer running on http://localhost:${PORT}` }));
});
