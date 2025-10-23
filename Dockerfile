# ===============================
# FASE 1 - Pré-carrega o modelo Kokoro TTS
# ===============================
FROM python:3.12-slim AS builder

WORKDIR /kokoro_cache

# Instalar dependências de compilação necessárias
RUN apt-get update && \
    apt-get install -y git build-essential python3-dev ffmpeg libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Instalar Kokoro TTS
RUN pip install --no-cache-dir kokoro-tts

# Pré-carregar vozes para cache
RUN kokoro-tts --list-voices || true


# ===============================
# FASE 2 - Backend Node + Kokoro
# ===============================
FROM node:20-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg git build-essential libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Copiar cache do modelo da primeira fase
COPY --from=builder /kokoro_cache /kokoro_cache
ENV KOKORO_CACHE_DIR=/kokoro_cache

# Instalar Kokoro TTS
RUN pip install --no-cache-dir kokoro-tts

# Criar diretórios necessários
RUN mkdir -p public audios

# Copiar arquivos do projeto
COPY server.js .
COPY index.html ./public/index.html

# Instalar dependências Node.js
RUN npm init -y && npm install express cors body-parser uuid

EXPOSE 3000
CMD ["node", "server.js"]
