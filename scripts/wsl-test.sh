#!/usr/bin/env bash
# Build and run the test suite inside WSL. Usage (from Windows): wsl -d Ubuntu -- bash scripts/wsl-test.sh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."

# Local dev wallet used by anchor as the provider/payer.
if [ ! -f ~/.config/solana/id.json ]; then
  solana-keygen new --no-bip39-passphrase --silent -o ~/.config/solana/id.json
fi

# Linux node_modules for the tests live inside WSL, separate from the Windows ones.
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund --loglevel=error
fi

anchor keys sync
anchor test "$@"
