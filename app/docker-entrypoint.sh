#!/bin/sh
set -eu
mkdir -p /data/google /data/sessions /data/tts /data/huggingface /data/codex /data/codex-work
chown -R node:node /data
exec gosu node "$@"
