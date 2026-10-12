FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
# Compile TypeScript files including mcp.ts
RUN npx tsc
CMD npx node-pg-migrate up && node dist/src/server.js
