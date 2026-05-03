FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/

RUN npm ci --omit=dev
RUN npm ci --prefix frontend

COPY . .
RUN npm run client:build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]