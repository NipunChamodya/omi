#!/bin/sh
set -eu
OMI_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# Prefer a supported standard Node on PATH. The existing official project-local
# distribution is only a fallback; never install or download a runtime implicitly.
# An explicit OMI_NODE_BINARY always takes precedence, including when invalid.
OMI_LOCAL_NODE="$OMI_SCRIPT_DIR/../../.remote-testing/tools/node-v22.23.4-darwin-arm64/bin/node"
OMI_NODE=${OMI_NODE_BINARY:-node}
if [ -n "${OMI_NODE_BINARY:-}" ]; then
  case "$OMI_NODE" in
    /*) ;;
    *) echo 'OMI_NODE_BINARY must be an executable absolute path; no services were started.' >&2; exit 2 ;;
  esac
  if [ ! -f "$OMI_NODE" ] || [ ! -x "$OMI_NODE" ]; then
    echo 'OMI_NODE_BINARY is not an executable file; no services were started.' >&2
    exit 2
  fi
fi
if [ -z "${OMI_NODE_BINARY:-}" ] &&
  ! "$OMI_NODE" --input-type=module -e '
    const { requireDeploymentNode } = await import(process.argv[1]);
    requireDeploymentNode(process.versions.node);
  ' "$OMI_SCRIPT_DIR/service-diagnostics.mjs" >/dev/null 2>&1 &&
  [ -x "$OMI_LOCAL_NODE" ]; then
  OMI_NODE="$OMI_LOCAL_NODE"
fi
case "${1:-}" in
  '') exec "$OMI_NODE" "$OMI_SCRIPT_DIR/remote-testing.mjs" start ;;
  --activate-google-registered) exec "$OMI_NODE" "$OMI_SCRIPT_DIR/remote-testing.mjs" activate ;;
  *) echo 'Usage: start-remote-testing.sh [--activate-google-registered]' >&2; exit 2 ;;
esac
