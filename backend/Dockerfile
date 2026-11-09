FROM oven/bun:1.3-debian
WORKDIR /app

ENV NODE_ENV=production

# Install deps (incl. dev deps: the prisma CLI runs `migrate deploy` at startup).
# postinstall runs `prisma generate`, which only needs a syntactically valid URL.
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" bun install --frozen-lockfile

COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" bunx prisma generate

EXPOSE 10000
CMD ["sh", "-c", "bunx prisma migrate deploy && exec bun src/index.ts"]
