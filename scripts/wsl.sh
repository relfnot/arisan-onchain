#!/usr/bin/env bash
# Run any command inside WSL with the Solana/Anchor toolchain on PATH, from the repo root.
# Usage (from Windows): wsl -d Ubuntu --cd /mnt/c/laragon/www/Arisan/arisan-onchain -- bash scripts/wsl.sh solana balance
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."

exec "$@"
