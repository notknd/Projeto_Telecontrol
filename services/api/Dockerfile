FROM node:22-alpine

WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY tsconfig.prisma.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate --schema prisma/schema.prisma
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
