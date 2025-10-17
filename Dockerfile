# Base: imagem oficial do Xray (mais estável que V2Ray puro)
FROM teddysun/xray:latest

# Copiar o arquivo de configuração
COPY config.json /etc/xray/config.json

# Porta padrão para WebSocket sobre HTTPS
EXPOSE 443

# Comando para iniciar o servidor
CMD ["xray", "run", "-config", "/etc/xray/config.json"]
