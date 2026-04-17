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
echo "==> Installing Semgrep (via pip)..."
if ! command -v semgrep &>/dev/null; then
  python3 -m pip install --quiet semgrep
else
  echo "    semgrep already installed: $(semgrep --version 2>/dev/null || echo 'ok')"
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
    | tar -xz -C /usr/local/bin gitleaks 2>/dev/null \
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
      "https://github.com/flyway/flyway/releases/download/flyway-${FLYWAY_VERSION}/flyway-commandline-${FLYWAY_VERSION}-linux-x64.tar.gz" \
      | tar -xz -C /opt/ 2>/dev/null \
      || { echo "    Flyway install skipped"; }
    if [ -d "$FLYWAY_DIR" ]; then
      ln -sf "${FLYWAY_DIR}/flyway" /usr/local/bin/flyway
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
