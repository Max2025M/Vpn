# Usar imagem oficial Netmaker Open Source
FROM gravitl/netmaker:latest

# Criar diretório de dados persistente
RUN mkdir -p /data

# Copiar arquivo de variáveis de ambiente
COPY .env /app/.env

# Definir variáveis de ambiente
ENV ADMIN_PASSWORD=${ADMIN_PASSWORD}
ENV WIREGUARD_PORT=${WIREGUARD_PORT}
ENV ENABLE_TLS=${ENABLE_TLS}
ENV DB_FILE=${DB_FILE}
ENV MASTER_KEY=${MASTER_KEY}
ENV USE_LOCAL_BROKER=${USE_LOCAL_BROKER}

# Expor portas necessárias
EXPOSE 51821/udp
EXPOSE 80
EXPOSE 443

# Comando de inicialização automático
CMD ["sh", "-c", "netmaker server --auto-setup"]
