FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server.js .
COPY shop.db .
EXPOSE 3000
CMD ["node", "server.js"]
