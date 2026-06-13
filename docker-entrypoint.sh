#!/bin/sh
set -e


# Injection des secrets
DB_PASS=$(cat /run/secrets/db_password)
export DATABASE_URL="postgresql://postgres:${DB_PASS}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}"

cat > public/config.js << CONF
window.__CONFIG__ = {
  BASE_URL: "${BASE_URL:-}",
  API_URL: "${API_URL:-}",
  WSS_URL: "${WSS_URL:-}",
  AUTH_API_URL: "${AUTH_API_URL:-}"
  AUTH_URL: "${AUTH_URL:-}"
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