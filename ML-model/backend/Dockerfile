FROM node:20-alpine AS base

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
