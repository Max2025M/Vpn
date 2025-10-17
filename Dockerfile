# Base oficial do XRay
FROM teddysun/xray:latest

# Copiar configuração
COPY config.json /etc/xray/config.json

# Expor porta TCP (443)
EXPOSE 443

# Comando de inicialização
CMD ["xray", "-config", "/etc/xray/config.json"]
