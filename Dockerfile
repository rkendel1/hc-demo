FROM node:22-trixie-slim AS native-validation

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install --no-install-recommends --yes binutils \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --include=optional
COPY scripts ./scripts
COPY src/runtime-config.js ./src/runtime-config.js
RUN node --version \
    && ldd --version \
    && npm run validate:native
RUN npm run smoke:native

FROM node:22-trixie-slim AS runtime

WORKDIR /app

COPY --from=native-validation /app/node_modules ./node_modules

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
