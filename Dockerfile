# Base: Debian
FROM debian:stable-slim

# Variáveis de ambiente
ENV ADMIN_PASSWORD=Massingue2004
ENV WIREGUARD_PORT=51821
ENV ENABLE_TLS=true
ENV DB_FILE=/data/netmaker.db
ENV MASTER_KEY=MinhaChaveForte123
ENV MQ_BROKER_HOST=localhost
ENV MQ_BROKER_PORT=1883

# Instalar dependências
RUN apt-get update && \
    apt-get install -y bash curl mosquitto net-tools && \
    rm -rf /var/lib/apt/lists/*

# Criar diretórios de dados
RUN mkdir -p /data /mosquitto/config /mosquitto/data /mosquitto/log

# Configuração do Mosquitto (broker interno)
RUN echo "allow_anonymous true" > /mosquitto/config/mosquitto.conf && \
    echo "listener 1883" >> /mosquitto/config/mosquitto.conf

# Baixar e instalar Netmaker
RUN curl -L https://github.com/gravitl/netmaker/releases/latest/download/netmaker-linux-amd64 -o /usr/local/bin/netmaker && \
    chmod +x /usr/local/bin/netmaker

# Expor portas
EXPOSE 51821/udp
EXPOSE 80
EXPOSE 443
EXPOSE 1883

# Script de inicialização
CMD bash -c "\
  echo 'Iniciando Mosquitto...' && \
  mosquitto -c /mosquitto/config/mosquitto.conf -d && \
  echo 'Aguardando 2s...' && sleep 2 && \
  echo 'Iniciando Netmaker...' && \
  export MQ_BROKER=${MQ_BROKER_HOST}:${MQ_BROKER_PORT} && \
  /usr/local/bin/netmaker server --auto-setup"
