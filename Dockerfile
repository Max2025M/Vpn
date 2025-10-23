# Fase de build para pré-cache dos modelos
FROM python:3.12-slim AS builder

WORKDIR /kokoro_cache

# Instalar dependências do sistema
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y git ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Instalar Kokoro CLI
RUN pip install --no-cache-dir kokoro-tts

# Pré-carregar vozes/modelos
RUN kokoro-tts --list-voices || true

# Fase final
FROM node:20-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip ffmpeg git && \
    rm -rf /var/lib/apt/lists/*

# Copiar cache de modelos
COPY --from=builder /kokoro_cache /kokoro_cache
ENV KOKORO_CACHE_DIR=/kokoro_cache

# Instalar Kokoro TTS
RUN pip install --no-cache-dir kokoro-tts

# Criar pasta public antes de copiar arquivos
RUN mkdir -p public

# Copiar backend e frontend
COPY server.js .
COPY index.html ./public/index.html

# Instalar dependências Node.js
RUN npm init -y && npm install express cors body-parser uuid

# Criar pasta de audios
RUN mkdir audios

EXPOSE 3000
CMD ["node", "server.js"]
