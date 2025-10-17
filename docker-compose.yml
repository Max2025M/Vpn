version: "3.8"

services:
  mosquitto:
    image: eclipse-mosquitto:2.0
    container_name: mosquitto
    restart: always
    ports:
      - "1883:1883"
    volumes:
      - mosquitto-data:/mosquitto/data
      - mosquitto-logs:/mosquitto/log
      - mosquitto-config:/mosquitto/config

  netmaker:
    image: gravitl/netmaker:latest
    container_name: netmaker
    restart: always
    env_file:
      - .env
    depends_on:
      - mosquitto
    ports:
      - "51821:51821/udp"   # WireGuard
      - "80:80"             # HTTP painel admin
      - "443:443"           # HTTPS painel admin
    volumes:
      - netmaker-data:/data
    command: >
      sh -c "export MQ_BROKER=${MQ_BROKER_HOST}:${MQ_BROKER_PORT} &&
             netmaker server --auto-setup"

volumes:
  mosquitto-data:
  mosquitto-logs:
  mosquitto-config:
  netmaker-data:
