#!/bin/sh
set -eu
mkdir -p /data/google /data/sessions /data/tts /data/codex /data/codex-work /data/advisor-library
node /app/app/cloudflare-state.mjs restore
chown -R node:node /data
gosu node node /app/app/cloudflare-state.mjs watch &
sync_pid=$!
gosu node node /app/app/server.mjs &
app_pid=$!
trap 'kill -TERM "$app_pid"; sleep 6; kill -TERM "$sync_pid"; wait' TERM INT
wait "$app_pid"
