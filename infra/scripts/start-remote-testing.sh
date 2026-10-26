#!/bin/sh
set -eu
OMI_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
case "${1:-}" in
  '') exec node "$OMI_SCRIPT_DIR/remote-testing.mjs" start ;;
  --activate-google-registered) exec node "$OMI_SCRIPT_DIR/remote-testing.mjs" activate ;;
  *) echo 'Usage: start-remote-testing.sh [--activate-google-registered]' >&2; exit 2 ;;
esac
