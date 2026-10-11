#!/usr/bin/env bash
# Build the program inside WSL. Usage (from Windows): wsl -d Ubuntu -- bash scripts/wsl-build.sh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."

anchor build "$@"
