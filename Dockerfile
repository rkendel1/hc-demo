FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY public ./public
COPY src ./src
COPY server.js ./
COPY README.md ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
