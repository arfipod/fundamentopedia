#!/usr/bin/env bash
set -euo pipefail

# Some environments inject deprecated npm env vars (npm_config_http_proxy),
# which trigger "Unknown env config \"http-proxy\"" warnings when using npm.
unset npm_config_http_proxy || true
unset npm_config_https_proxy || true

if [ $# -eq 0 ]; then
  exec ./node_modules/.bin/vitest run
fi

exec ./node_modules/.bin/vitest "$@"
