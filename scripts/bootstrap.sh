#!/usr/bin/env bash
# Install all tools required by repo-auditor agents.
# Safe to re-run — skips anything already installed.
set -euo pipefail

echo ""
echo "==> Installing npm workspace dependencies..."
cd /workspace
npm install

echo ""
echo "==> Installing Claude Code CLI..."
if ! command -v claude &>/dev/null; then
  npm install -g @anthropic-ai/claude-code
else
  echo "    claude already installed: $(claude --version 2>/dev/null || echo 'ok')"
fi

echo ""
echo "==> Installing OpenAI Codex CLI..."
if ! command -v codex &>/dev/null; then
  npm install -g @openai/codex
else
  echo "    codex already installed"
fi

echo ""
echo "==> Installing depcheck and npq..."
npm install -g depcheck npq 2>/dev/null || true

echo ""
echo "==> Installing Semgrep (via Docker wrapper)..."
# The pip-distributed semgrep package ships a Windows binary (semgrep-core.exe) that
# cannot run on Linux. Use the official Docker image instead and wrap it in a script.
if ! command -v docker &>/dev/null; then
  echo "    WARNING: docker not found — semgrep will not be available"
elif docker image inspect semgrep/semgrep:latest &>/dev/null 2>&1; then
  echo "    semgrep Docker image already present"
else
  echo "    Pulling semgrep/semgrep Docker image (cached for future use)..."
  docker pull semgrep/semgrep:latest 2>&1 | tail -3 || echo "    semgrep pull failed — will retry on first audit run"
fi

# Install a thin wrapper at /usr/local/bin/semgrep that delegates to Docker.
# This means audit scripts can call `semgrep` directly without knowing about Docker.
if command -v docker &>/dev/null && ! grep -q "docker run.*semgrep/semgrep" /usr/local/bin/semgrep 2>/dev/null; then
  sudo tee /usr/local/bin/semgrep > /dev/null << 'SEMGREP_WRAPPER'
#!/usr/bin/env bash
# Thin wrapper: run semgrep via Docker so the Linux binary is used.
exec docker run --rm \
  -v "$(pwd):/src" \
  -w /src \
  semgrep/semgrep \
  semgrep "$@"
SEMGREP_WRAPPER
  sudo chmod +x /usr/local/bin/semgrep
  echo "    semgrep wrapper installed at /usr/local/bin/semgrep"
fi

echo ""
echo "==> Installing gitleaks..."
if ! command -v gitleaks &>/dev/null; then
  GITLEAKS_VERSION="8.18.0"
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) GITLEAKS_ARCH="x64" ;;
    aarch64|arm64) GITLEAKS_ARCH="arm64" ;;
    *) GITLEAKS_ARCH="x64" ;;
  esac
  curl -sSfL \
    "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GITLEAKS_ARCH}.tar.gz" \
    | sudo tar -xz -C /usr/local/bin gitleaks 2>/dev/null \
    || echo "    gitleaks install skipped (check permissions)"
else
  echo "    gitleaks already installed: $(gitleaks version 2>/dev/null || echo 'ok')"
fi

echo ""
echo "==> Installing Flyway CLI..."
if ! command -v flyway &>/dev/null; then
  FLYWAY_VERSION="10.10.0"
  FLYWAY_DIR="/opt/flyway-${FLYWAY_VERSION}"
  if [ ! -d "$FLYWAY_DIR" ]; then
    curl -sSfL \
      "https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/${FLYWAY_VERSION}/flyway-commandline-${FLYWAY_VERSION}-linux-x64.tar.gz" \
      | sudo tar -xz -C /opt/ 2>/dev/null \
      || { echo "    Flyway install skipped"; }
    if [ -d "$FLYWAY_DIR" ]; then
      sudo ln -sf "${FLYWAY_DIR}/flyway" /usr/local/bin/flyway
    fi
  fi
else
  echo "    flyway already installed: $(flyway -v 2>/dev/null | head -1 || echo 'ok')"
fi

echo ""
echo "============================================"
echo " Bootstrap complete. Tool summary:"
echo "============================================"
for tool in claude codex semgrep gitleaks flyway depcheck node npm gh java; do
  if command -v "$tool" &>/dev/null; then
    echo "  [ok] $tool"
  else
    echo "  [--] $tool  (not found — may need manual install)"
  fi
done

echo ""
echo " Next steps:"
echo "   1. Copy .env.example to .env and fill in your API keys"
echo "   2. Start the API:      npm run dev:api"
echo "   3. Start the frontend: npm run dev:frontend"
echo "   4. Run an audit:       ./scripts/run-with-claude.sh owner/repo"
echo "                          ./scripts/run-with-codex.sh  owner/repo"
echo ""
