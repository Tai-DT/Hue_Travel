# 🚀 Huế Travel — Deployment Guide

Hướng dẫn triển khai production.

---

## Architecture

```
                    ┌─────────────────────┐
                    │      Nginx          │
                    │  (Reverse Proxy)    │
                    └───────┬─────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
    │  API    │       │  Web    │       │ Provider│
    │(Go:8080)│       │(Next:3k)│       │(Next:3k1│
    └────┬────┘       └─────────┘       └─────────┘
         │
    ┌────▼────────────────────┐
    │   PostgreSQL │ Redis    │
    │   MinIO │ Meilisearch   │
    └─────────────────────────┘
```

---

## Production Deploy

### 1. Server Requirements
- Ubuntu 22.04+ hoặc Debian 12+
- 4 CPU, 8GB RAM (recommended)
- Docker + Docker Compose v2
- Domain + SSL (Let's Encrypt)

### 2. Initial Setup

```bash
# SSH vào server
ssh user@your-server

# Clone repository
git clone https://github.com/your-org/hue-travel.git
cd hue-travel

# Setup environment
cd deploy
cp .env.example .env
nano .env  # Fill in production values
```

### 3. Environment Variables (Production)

```env
# CRITICAL — Must change!
APP_ENV=production
JWT_SECRET=<random-64-char-string>
POSTGRES_PASSWORD=<strong-password>
MINIO_ROOT_PASSWORD=<strong-password>

# Domain
APP_URL=https://api.huetravel.vn
CORS_ORIGINS=https://admin.huetravel.vn,https://provider.huetravel.vn

# API Keys (required for full functionality)
GOOGLE_MAPS_API_KEY=<your-key>
GEMINI_API_KEY=<your-key>
VNPAY_TMN_CODE=<your-code>
VNPAY_HASH_SECRET=<your-secret>
ESMS_API_KEY=<your-key>
ESMS_SECRET_KEY=<your-secret>
FCM_SERVER_KEY=<your-key>
```

### 4. Deploy

```bash
# Build and start all services
docker compose -f deploy/docker-compose.prod.yml up -d --build

# Check status
docker compose -f deploy/docker-compose.prod.yml ps

# View logs
docker compose -f deploy/docker-compose.prod.yml logs -f api
```

### 5. SSL (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d api.huetravel.vn
sudo certbot --nginx -d admin.huetravel.vn
sudo certbot --nginx -d provider.huetravel.vn

# Auto-renew
sudo crontab -e
# Add: 0 0 1 * * certbot renew --quiet
```

---

## Update/Rollback

### Update
```bash
cd hue-travel
git pull origin main
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

### Rollback
```bash
git log --oneline -5       # Find commit
git checkout <commit-hash>
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

---

## Database Backup

### Auto backup (cron)
```bash
# Create backup script
cat > /opt/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker exec hue-postgres pg_dump -U huetravel hue_travel | gzip > "$BACKUP_DIR/hue_travel_$TIMESTAMP.sql.gz"

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
echo "[$(date)] Backup completed: hue_travel_$TIMESTAMP.sql.gz"
EOF

chmod +x /opt/scripts/backup-db.sh

# Schedule daily at 3 AM
echo "0 3 * * * /opt/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1" | crontab -
```

### Manual backup
```bash
docker exec hue-postgres pg_dump -U huetravel hue_travel > backup.sql
```

### Restore
```bash
docker exec -i hue-postgres psql -U huetravel hue_travel < backup.sql
```

---

## Monitoring

### Health Checks
```bash
# API Health
curl https://api.huetravel.vn/api/v1/health

# Docker health
docker compose -f deploy/docker-compose.prod.yml ps
```

### Logs
```bash
# All services
docker compose -f deploy/docker-compose.prod.yml logs -f

# Specific service
docker compose -f deploy/docker-compose.prod.yml logs -f api
docker compose -f deploy/docker-compose.prod.yml logs -f nginx
```

### Resource Usage
```bash
docker stats --no-stream
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET (64+ characters)
- [ ] Enable SSL/HTTPS
- [ ] Configure firewall (ufw)
- [ ] Restrict database access
- [ ] Enable Redis password
- [ ] Set CORS to specific domains
- [ ] Regular security updates
- [ ] Database backups automated
- [ ] Log monitoring setup
