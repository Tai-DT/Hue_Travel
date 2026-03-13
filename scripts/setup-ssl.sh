#!/bin/bash
# ============================================
# Huế Travel — SSL Setup with Let's Encrypt
# ============================================
# Usage: ./scripts/setup-ssl.sh
# Renew: certbot renew --quiet
# Cron:  0 3 */60 * * certbot renew --quiet && docker compose -f deploy/docker-compose.prod.yml exec nginx nginx -s reload
# ============================================

set -euo pipefail

DOMAINS="${SSL_DOMAINS:-api.huetravel.vn admin.huetravel.vn provider.huetravel.vn}"
EMAIL="${SSL_EMAIL:-admin@huetravel.vn}"
SSL_DIR="./deploy/nginx/ssl"
WEBROOT_DIR="./deploy/certbot"

echo "🔐 Setting up SSL for: ${DOMAINS}"

# ---- Check prerequisites ----
if ! command -v certbot &> /dev/null; then
  echo "📦 Installing certbot..."
  if command -v apt-get &> /dev/null; then
    sudo apt-get update && sudo apt-get install -y certbot
  elif command -v brew &> /dev/null; then
    brew install certbot
  else
    echo "❌ Please install certbot: https://certbot.eff.org/"
    exit 1
  fi
fi

# ---- Create directories ----
mkdir -p "${SSL_DIR}" "${WEBROOT_DIR}"

# ---- Generate self-signed cert first (for nginx startup) ----
if [ ! -f "${SSL_DIR}/fullchain.pem" ]; then
  echo "📋 Generating temporary self-signed certificate..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${SSL_DIR}/privkey.pem" \
    -out "${SSL_DIR}/fullchain.pem" \
    -subj "/CN=$(echo ${DOMAINS} | cut -d' ' -f1)"
  echo "✅ Temporary SSL cert created"
fi

# ---- Request Let's Encrypt certificate ----
echo ""
echo "🌐 Requesting Let's Encrypt certificate..."
echo "   Domains: ${DOMAINS}"
echo "   Email: ${EMAIL}"
echo ""

DOMAIN_ARGS=""
for domain in ${DOMAINS}; do
  DOMAIN_ARGS="${DOMAIN_ARGS} -d ${domain}"
done

certbot certonly \
  --webroot \
  --webroot-path="${WEBROOT_DIR}" \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  ${DOMAIN_ARGS}

# ---- Copy certs ----
FIRST_DOMAIN=$(echo ${DOMAINS} | cut -d' ' -f1)
CERT_DIR="/etc/letsencrypt/live/${FIRST_DOMAIN}"

if [ -d "${CERT_DIR}" ]; then
  cp "${CERT_DIR}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
  cp "${CERT_DIR}/privkey.pem" "${SSL_DIR}/privkey.pem"
  echo "✅ SSL certificates installed to ${SSL_DIR}"
else
  echo "⚠️  Cert directory not found. Keeping self-signed cert."
fi

echo ""
echo "✅ SSL setup complete!"
echo ""
echo "Next steps:"
echo "  1. Restart nginx: docker compose -f deploy/docker-compose.prod.yml restart nginx"
echo "  2. Add cron for auto-renewal:"
echo '     0 3 */60 * * certbot renew --quiet && docker compose -f deploy/docker-compose.prod.yml exec nginx nginx -s reload'
