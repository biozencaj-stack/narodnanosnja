#!/bin/bash

# ===========================================
# Planika Server Setup Script
# Pokreni kao root ili sa sudo
# ===========================================

set -e  # Stop on error

echo "========================================"
echo "🚀 Planika Server Setup"
echo "========================================"

# Boje za output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Update sistema
echo -e "${YELLOW}[1/7] Updating system...${NC}"
apt update && apt upgrade -y

# 2. Instalacija Node.js 22.x
echo -e "${YELLOW}[2/7] Installing Node.js 22.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
echo -e "${GREEN}Node.js version: $(node -v)${NC}"

# 3. Instalacija PM2
echo -e "${YELLOW}[3/7] Installing PM2...${NC}"
npm install -g pm2

# 4. Instalacija Nginx
echo -e "${YELLOW}[4/7] Installing Nginx...${NC}"
apt install -y nginx
systemctl enable nginx
systemctl start nginx

# 5. Instalacija PostgreSQL
echo -e "${YELLOW}[5/7] Installing PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# 6. Instalacija dodatnih alata
echo -e "${YELLOW}[6/7] Installing additional tools...${NC}"
apt install -y git unzip

# 7. Kreiranje direktorijuma
echo -e "${YELLOW}[7/7] Creating directories...${NC}"
mkdir -p /var/www/planika
mkdir -p /var/log/planika

echo ""
echo -e "${GREEN}========================================"
echo "✅ Server setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Create user: adduser planikaman"
echo "2. Add to sudo: usermod -aG sudo planikaman"
echo "3. Set ownership: chown -R planikaman:planikaman /var/www/planika"
echo "4. Set ownership: chown -R planikaman:planikaman /var/log/planika"
echo "5. Setup PostgreSQL database (see guide)"
echo "6. Upload files via WinSCP"
echo "========================================"
echo -e "${NC}"
