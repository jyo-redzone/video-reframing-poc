#!/usr/bin/env bash
# Activate the venv and run export.py with whatever args the user passed.
# Assumes setup.sh has already been run successfully.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "Virtualenv not found at $VENV_DIR. Run setup.sh first." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

exec python "$SCRIPT_DIR/export.py" "$@"
