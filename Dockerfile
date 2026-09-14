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

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl libssl3

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static     ./.next/static
COPY --from=build /app/public           ./public
COPY --from=build /app/src/generated    ./src/generated
COPY --from=build /app/prisma           ./prisma
COPY --from=build /app/prisma.config.ts ./
# node_modules complet (le build standalone ne trace que les deps de runtime,
# pas la CLI prisma dont on a besoin ici pour lancer les migrations)
COPY --from=build /app/node_modules     ./node_modules

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]