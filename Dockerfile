# Base oficial do Netmaker
FROM gravitl/netmaker:latest

# Cria diretório de dados persistentes
RUN mkdir -p /data

# Copia arquivo de configuração de variáveis de ambiente
COPY .env /app/.env

# Define variáveis de ambiente
ENV ADMIN_PASSWORD=${ADMIN_PASSWORD}
ENV WIREGUARD_PORT=${WIREGUARD_PORT}
ENV ENABLE_TLS=${ENABLE_TLS}
ENV DB_FILE=${DB_FILE}

# Expõe portas necessárias
EXPOSE 51821/udp
EXPOSE 80
EXPOSE 443

# Comando de inicialização automática
CMD ["sh", "-c", "netmaker server --auto-setup"]
