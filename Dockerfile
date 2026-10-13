FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium python3 python3-venv ca-certificates libsndfile1 gosu && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm install -g @openai/codex@0.162.1
COPY package*.json ./
RUN npm ci --omit=dev
RUN python3 -m venv /app/.venv-tts && /app/.venv-tts/bin/pip install --no-cache-dir --upgrade pip && /app/.venv-tts/bin/pip install --no-cache-dir torch==2.14.1+cpu --extra-index-url https://download.pytorch.org/whl/cpu && /app/.venv-tts/bin/pip install --no-cache-dir pocket-tts==3.3.0
COPY . .
RUN mkdir -p /data/google /data/sessions /data/tts /data/huggingface /data/codex /data/codex-work && chown -R node:node /data && chown node:node /app
ENV PORT=4730 HOST=0.0.0.0 PUBLIC_URL=https://advisory.viralseo.net COUNCIL_RUNNER=api AI_PROVIDER=codex CHROME_PATH=/usr/bin/chromium CHROME_NO_SANDBOX=1 GOOGLE_TOKEN_DIR=/data/google SESSIONS_DIR=/data/sessions TTS_DATA_DIR=/data/tts HF_HOME=/data/huggingface ADVISORY_CODEX_HOME=/data/codex ADVISORY_CODEX_WORK=/data/codex-work
EXPOSE 4730
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4730/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh","app/docker-entrypoint.sh"]
CMD ["node","app/server.mjs"]
