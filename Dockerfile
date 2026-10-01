# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE}
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --omit=dev; else npm ci --omit=dev; fi
COPY --chown=node:node src ./src
COPY --chown=node:node db ./db
COPY --chown=node:node docs/dashboard.html ./docs/dashboard.html
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
