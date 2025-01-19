FROM node:22-slim AS builder

WORKDIR /workdir

RUN npx -y playwright@1.49.1 install chromium --with-deps --only-shell

COPY package*.json ./

RUN npm ci

COPY main.ts .

ENTRYPOINT [ "npx", "tsx", "main.ts" ]
