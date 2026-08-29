#!/bin/bash
# ===========================================
# Planika Automated Backup Script
# ===========================================
# Pokreće se kao cron job ili ručno
#
# Instalacija:
#   1. Kopiraj na server: scp backup.sh planikaman@server:/usr/local/bin/planika-backup.sh
#   2. chmod +x /usr/local/bin/planika-backup.sh
#   3. Dodaj u cron: 0 3 * * * /usr/local/bin/planika-backup.sh
#
# ===========================================

set -e

# ============ KONFIGURACIJA ============
BACKUP_DIR="/var/backups/planika"
DB_NAME="planika_shop"
DB_USER="planika_user"
APP_DIR="/var/www/planika"
RETENTION_DAYS=7
RETENTION_WEEKS=4
RETENTION_MONTHS=12
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/planika-backup.log"

# Cloud backup (opciono) - postavi ove varijable
# RCLONE_REMOTE="hetzner-backup:planika"  # ili s3:bucket/planika
# GPG_PASSPHRASE="your-encryption-passphrase"

# ============ FUNKCIJE ============

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

# ============ MAIN ============

log "=========================================="
log "Starting Planika backup"
log "=========================================="

# Kreiraj foldere
mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}
mkdir -p "$(dirname "$LOG_FILE")"

# 1. DATABASE BACKUP
log "[1/5] Backing up PostgreSQL database..."
DUMP_FILE="$BACKUP_DIR/daily/db_${DATE}.dump"

if sudo -u postgres pg_dump -Fc "$DB_NAME" > "$DUMP_FILE" 2>/dev/null; then
    DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    log "Database backup OK: $DUMP_FILE ($DUMP_SIZE)"
else
    error_exit "Database backup failed!"
fi

# 2. ENV BACKUP (enkriptovano ako je GPG_PASSPHRASE postavljen)
log "[2/5] Backing up .env file..."
if [ -f "$APP_DIR/.env" ]; then
    if [ -n "$GPG_PASSPHRASE" ]; then
        echo "$GPG_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 -c \
            -o "$BACKUP_DIR/daily/env_${DATE}.gpg" "$APP_DIR/.env" 2>/dev/null
        log ".env backup OK (encrypted)"
    else
        cp "$APP_DIR/.env" "$BACKUP_DIR/daily/env_${DATE}.txt"
        chmod 600 "$BACKUP_DIR/daily/env_${DATE}.txt"
        log ".env backup OK (plain - consider setting GPG_PASSPHRASE)"
    fi
else
    log ".env not found, skipping"
fi

# 3. UPLOADS BACKUP (ako postoji)
log "[3/5] Backing up uploads..."
if [ -d "$APP_DIR/public/uploads" ]; then
    tar -czf "$BACKUP_DIR/daily/uploads_${DATE}.tar.gz" -C "$APP_DIR/public" uploads 2>/dev/null
    log "Uploads backup OK"
else
    log "No uploads folder, skipping"
fi

# 4. NGINX CONFIG BACKUP
log "[4/5] Backing up Nginx config..."
if [ -f "/etc/nginx/sites-available/planika" ]; then
    cp "/etc/nginx/sites-available/planika" "$BACKUP_DIR/daily/nginx_${DATE}.conf"
    log "Nginx config backup OK"
else
    log "Nginx config not found, skipping"
fi

# 5. CLEANUP OLD BACKUPS
log "[5/5] Cleaning up old backups..."

# Daily - čuvaj RETENTION_DAYS dana
find "$BACKUP_DIR/daily" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
DAILY_COUNT=$(ls -1 "$BACKUP_DIR/daily"/*.dump 2>/dev/null | wc -l || echo 0)
log "Daily backups retained: $DAILY_COUNT"

# Weekly backup (svake nedelje)
if [ "$(date +%u)" -eq 7 ]; then
    cp "$DUMP_FILE" "$BACKUP_DIR/weekly/db_week_$(date +%Y%W).dump"
    log "Weekly backup created"
    find "$BACKUP_DIR/weekly" -type f -mtime +$((RETENTION_WEEKS * 7)) -delete 2>/dev/null || true
fi

# Monthly backup (prvi dan meseca)
if [ "$(date +%d)" -eq "01" ]; then
    cp "$DUMP_FILE" "$BACKUP_DIR/monthly/db_month_$(date +%Y%m).dump"
    log "Monthly backup created"
    find "$BACKUP_DIR/monthly" -type f -mtime +$((RETENTION_MONTHS * 30)) -delete 2>/dev/null || true
fi

# 6. CLOUD SYNC (opciono)
if [ -n "$RCLONE_REMOTE" ]; then
    log "Syncing to cloud storage..."
    if rclone sync "$BACKUP_DIR/daily" "$RCLONE_REMOTE/daily" --quiet; then
        log "Cloud sync OK"
    else
        log "WARNING: Cloud sync failed"
    fi
fi

# SUMMARY
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "=========================================="
log "Backup completed successfully!"
log "Total backup size: $TOTAL_SIZE"
log "=========================================="
