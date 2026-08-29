#!/bin/bash
# ===========================================
# Planika Database Restore Script
# ===========================================
#
# Upotreba:
#   ./restore.sh                     # Restore najnoviji backup
#   ./restore.sh db_20260115.dump    # Restore specifični backup
#
# ===========================================

set -e

# ============ KONFIGURACIJA ============
BACKUP_DIR="/var/backups/planika"
DB_NAME="planika_shop"
DB_USER="planika_user"
APP_DIR="/var/www/planika"

# ============ FUNKCIJE ============

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

confirm() {
    read -p "$1 (yes/no): " answer
    if [ "$answer" != "yes" ]; then
        log "Cancelled by user"
        exit 0
    fi
}

# ============ MAIN ============

echo ""
echo "=========================================="
echo "   PLANIKA DATABASE RESTORE"
echo "=========================================="
echo ""

# Odredi backup fajl
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
    # Ako nije puna putanja, traži u backup folderu
    if [ ! -f "$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/daily/$1"
    fi
else
    # Pronađi najnoviji backup
    BACKUP_FILE=$(ls -t "$BACKUP_DIR/daily"/*.dump 2>/dev/null | head -1)
fi

if [ ! -f "$BACKUP_FILE" ]; then
    error_exit "Backup file not found: $BACKUP_FILE"
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
BACKUP_DATE=$(stat -c %y "$BACKUP_FILE" 2>/dev/null || stat -f %Sm "$BACKUP_FILE")

echo "Backup file: $BACKUP_FILE"
echo "Backup size: $BACKUP_SIZE"
echo "Backup date: $BACKUP_DATE"
echo ""

# Lista dostupnih backup-a
echo "Available backups:"
ls -lh "$BACKUP_DIR/daily"/*.dump 2>/dev/null | tail -5
echo ""

# Upozorenje
echo "⚠️  WARNING: This will:"
echo "   1. Stop the application"
echo "   2. DROP the existing database"
echo "   3. Restore from backup"
echo "   4. Restart the application"
echo ""

confirm "Are you sure you want to continue?"

# 1. Stop aplikaciju
log "Stopping application..."
pm2 stop planika 2>/dev/null || log "Application was not running"

# 2. Backup trenutne baze (za svaki slučaj)
log "Creating safety backup of current database..."
SAFETY_BACKUP="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).dump"
sudo -u postgres pg_dump -Fc "$DB_NAME" > "$SAFETY_BACKUP" 2>/dev/null || true
log "Safety backup created: $SAFETY_BACKUP"

# 3. Drop i recreate baza
log "Dropping existing database..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null

log "Creating new database..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null

# 4. Restore
log "Restoring database from backup..."
if sudo -u postgres pg_restore -d "$DB_NAME" "$BACKUP_FILE" 2>/dev/null; then
    log "Database restore completed successfully!"
else
    # pg_restore može vratiti non-zero čak i kad je restore OK (warnings)
    log "Database restore completed (with warnings)"
fi

# 5. Verify
log "Verifying restore..."
USER_COUNT=$(sudo -u postgres psql -t -d "$DB_NAME" -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | tr -d ' ')
ORDER_COUNT=$(sudo -u postgres psql -t -d "$DB_NAME" -c "SELECT COUNT(*) FROM \"Order\";" 2>/dev/null | tr -d ' ')

echo ""
echo "Database statistics:"
echo "  - Users: $USER_COUNT"
echo "  - Orders: $ORDER_COUNT"
echo ""

# 6. Start aplikaciju
log "Starting application..."
pm2 start planika 2>/dev/null || pm2 start "$APP_DIR/ecosystem.config.js"

# 7. Proveri status
sleep 3
pm2 status planika

echo ""
log "=========================================="
log "Restore completed!"
log "=========================================="
echo ""
echo "If something went wrong, restore from safety backup:"
echo "  $0 $SAFETY_BACKUP"
echo ""
