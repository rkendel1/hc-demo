FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install --no-install-recommends --yes binutils \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --include=optional
COPY scripts ./scripts
RUN npm run validate:native

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
