# Rana QR — imagen mínima: Node 24 (trae SQLite) sin dependencias de npm.
FROM node:24-slim

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    TRUST_PROXY=1

WORKDIR /app
COPY servidor/server.mjs servidor/package.json ./servidor/
COPY servidor/publico ./servidor/publico
# el editor y los módulos compartidos (/admin/js/…) viven en rana-qr
COPY rana-qr ./rana-qr

# la base de datos vive en un volumen; la app corre sin privilegios
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "servidor/server.mjs"]
