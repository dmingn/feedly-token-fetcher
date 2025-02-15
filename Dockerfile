FROM node:22-slim AS builder

WORKDIR /workdir

ARG PLAYWRIGHT_VERSION=1.49.1
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install chromium --with-deps --only-shell

COPY package*.json ./

RUN npm ci

COPY main.ts .

ENTRYPOINT [ "npx", "tsx", "main.ts" ]
