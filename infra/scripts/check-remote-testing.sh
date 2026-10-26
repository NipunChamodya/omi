#!/bin/sh
set -eu
OMI_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$OMI_SCRIPT_DIR/remote-testing.mjs" check
