#!/usr/bin/env bash
# Create a venv at tools/export-cli/.venv and install the pinned
# dependencies. Run once after cloning. Re-run to refresh deps after a
# requirements.txt bump.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

pip install --upgrade pip
pip install -r "$SCRIPT_DIR/requirements.txt"

echo "Setup complete. Run ./export.sh <track.json> to export a clip."
