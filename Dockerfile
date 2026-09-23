FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=optional
RUN npm run validate:native

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
