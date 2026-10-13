#!/bin/sh
set -eu
mkdir -p /data/google /data/sessions /data/tts /data/huggingface
chown -R node:node /data
exec gosu node "$@"
