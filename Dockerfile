ARG ML_RUNTIME_VERSION=0.2.3

FROM node:22-trixie-slim AS native-validation

ARG ML_RUNTIME_VERSION
ENV ML_RUNTIME_MODEL_DIR=/app/models

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install --no-install-recommends --yes binutils ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --include=optional
COPY scripts ./scripts
COPY src/runtime-config.js ./src/runtime-config.js
RUN node --version \
    && ldd --version \
    && npm run validate:native
RUN curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
      "https://raw.githubusercontent.com/rkendel1/rust-ml-runtime/v${ML_RUNTIME_VERSION}/install.sh" \
      --output /tmp/install-ml-runtime.sh \
    && ML_RUNTIME_VERSION="${ML_RUNTIME_VERSION}" \
       ML_RUNTIME_INSTALL_DIR=/usr/local/bin \
       sh /tmp/install-ml-runtime.sh \
    && rm /tmp/install-ml-runtime.sh
RUN ml-runtime model install laya \
    && ml-runtime model doctor laya
RUN npm run smoke:native

FROM node:22-trixie-slim AS runtime

WORKDIR /app

COPY --from=native-validation /app/node_modules ./node_modules
COPY --from=native-validation /app/models ./models

COPY . .

ENV ML_RUNTIME_MODEL_DIR=/app/models

EXPOSE 8000

CMD ["npm", "start"]
