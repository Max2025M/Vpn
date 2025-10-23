FROM node:20-slim

# Instalar dependências de sistema
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip git ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar Kokoro TTS
RUN pip3 install --no-cache-dir kokoro-tts

# Copiar arquivos da aplicação
COPY server.js .
COPY index.html .

# Instalar dependências Node.js
RUN npm init -y && npm install express cors body-parser uuid

EXPOSE 3000
CMD ["node", "server.js"]
