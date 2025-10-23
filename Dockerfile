# Base leve com Node.js e dependências mínimas
FROM node:20-slim AS builder

# Instalar dependências de sistema
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv git git-lfs build-essential ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Ativar git-lfs
RUN git lfs install || true

WORKDIR /opt/kokoro_cache

# Instala o pacote kokoro + biblioteca CLI de exemplo, para baixar pesos
RUN pip3 install --no-cache-dir kokoro \
    && pip3 install --no-cache-dir git+https://github.com/cheuerde/kokoro-tts-cli.git || true

# Executar um comando kokoro-tts de listagem para forçar o download de modelos/pesos
RUN kokoro-tts --list-voices || true

# Agora criamos a imagem final com Node.js + os pesos já em cache
FROM node:20-slim

# copiar o cache do modelo
COPY --from=builder /opt/kokoro_cache /opt/kokoro_cache

# Instalar sistema e dependências necessárias em runtime
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      python3 python3-pip git-lfs ffmpeg && \
    rm -rf /var/lib/apt/lists/*

RUN git lfs install || true

# configurar PATH ou ambiente para que kokoro CLI encontre os modelos em /opt/kokoro_cache
ENV KOKORO_CACHE_DIR=/opt/kokoro_cache

WORKDIR /app

# Copiar arquivos da aplicação
COPY server.js ./server.js
COPY public/index.html ./public/index.html

# Inicializa package.json e instala dependências Node
RUN npm init -y && npm install express cors uuid

# Copiar diretório audios
RUN mkdir audios

# Instalar kokoro (usa o cache)
RUN pip3 install --no-cache-dir kokoro \
    && pip3 install --no-cache-dir git+https://github.com/cheuerde/kokoro-tts-cli.git || true

# Expor porta
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
