#!/bin/sh
set -e


# Injection des secrets
DB_PASS=$(cat /run/secrets/db_password)
export DATABASE_URL="postgresql://postgres:${DB_PASS}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}"
export COINS_API_KEY=$(cat /run/secrets/coins_api_key)
export JWT_SECRET=$(cat /run/secrets/jwt_secret)

cat > public/config.js << CONF
window.__CONFIG__ = {
  BASE_URL: "${BASE_URL:-}",
  API_URL: "${API_URL:-}",
  WSS_URL: "${WSS_URL:-}",
  AUTH_API_URL: "${AUTH_API_URL:-}",
  AUTH_URL: "${AUTH_URL:-}",
  BITCOIN_API_URL: "${BITCOIN_API_URL:-}"
};
CONF

echo "Waiting migration flag..."
until [ -f /migrations/done ] && \
  [ "$(ls prisma/migrations/ | grep -v migration_lock.toml | sort | sha256sum | cut -d' ' -f1)" = "$(cat /migrations/done)" ]; do
  echo "Migration(s) not applied, retry..."
  sleep 2
done

echo "Migrations OK, starting..."
exec node server.js