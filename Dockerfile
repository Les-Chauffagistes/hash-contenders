FROM node:22-alpine AS build
WORKDIR /app

# Fixes prisma generate
ENV DATABASE_URL="dummy"

# Fixes type checking
ENV SESSION_PASSWORD="dummy"

COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS migrator
WORKDIR /app
COPY --from=build /app/node_modules      ./node_modules
COPY --from=build /app/prisma            ./prisma
COPY --from=build /app/prisma.config.ts  ./

CMD ["sh", "-c", "\
  export DATABASE_URL=postgresql://${DB_USER}:$(cat /run/secrets/db_password)@${DB_HOST}:5432/${DB_NAME} && \
  until npx prisma migrate deploy; do echo 'DB pas prête, retry...'; sleep 2; done && \
  ls prisma/migrations/ | grep -v migration_lock.toml | sort | sha256sum | cut -d' ' -f1 > /migrations/done && \
  echo 'Flag done, migrations applied'"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl libssl3

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static     ./.next/static
COPY --from=build /app/public           ./public
COPY --from=build /app/generated        ./generated
COPY --from=build /app/prisma           ./prisma

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]