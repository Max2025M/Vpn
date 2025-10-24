# Imagem leve Node.js
FROM node:18-slim

# Instala Python e gTTS
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir gTTS

# Cria diretórios
WORKDIR /app
RUN mkdir -p /app/public /app/audios

# Copia arquivos
COPY server.js .
COPY index.html ./public/index.html

# Instala dependências Node
RUN npm init -y && npm install express cors uuid

EXPOSE 3000
CMD ["node", "server.js"]
