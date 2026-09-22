FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=optional

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
