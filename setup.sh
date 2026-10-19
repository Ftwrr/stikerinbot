#!/usr/bin/env bash

# ==============================================================
# StikerinBot - Easy Setup & Interactive Installer
# ==============================================================

set -e

# Warna CLI
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}         🤖 STIKERIN BOT - SETUP & INSTALLER         ${NC}"
echo -e "${CYAN}======================================================${NC}"
echo ""

# 1. Cek atau Pasang Runtime Bun
if ! command -v bun &> /dev/null; then
    echo -e "${YELLOW}⚡ Bun belum terpasang di sistem. Memasang Bun...${NC}"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

echo -e "${GREEN}✓ Runtime: $(bun --version)${NC}"
echo ""

# 2. Pilihan Konfigurasi Database
echo -e "${BLUE}Pilih Database Storage Driver yang ingin digunakan:${NC}"
echo "1) SQLite (Rekomendasi - Cepat, Tanpa Akun Cloud, File Lokal)"
echo "2) MongoDB (Cloud / Remote Mongo URI)"
echo "3) Supabase (PostgreSQL Cloud)"
read -rp "Masukkan pilihan [1-3] (Default: 1): " db_choice

DB_DRIVER="sqlite"
MONGODB_URI=""
SUPABASE_URL=""
SUPABASE_KEY=""

case $db_choice in
    2)
        DB_DRIVER="mongodb"
        read -rp "Masukkan MONGODB_URI (contoh: mongodb+srv://...): " MONGODB_URI
        ;;
    3)
        DB_DRIVER="supabase"
        read -rp "Masukkan SUPABASE_URL: " SUPABASE_URL
        read -rp "Masukkan SUPABASE_KEY: " SUPABASE_KEY
        ;;
    *)
        DB_DRIVER="sqlite"
        ;;
esac
echo -e "${GREEN}✓ Database dipilih: ${DB_DRIVER}${NC}\n"

# 3. Input Nomor WhatsApp Bot untuk Pairing
echo -e "${BLUE}Nomor WhatsApp untuk Bot (Awali dengan kode negara 62, contoh: 6281234567890):${NC}"
read -rp "Nomor Bot: " BOT_PHONE
BOT_PHONE=$(echo "$BOT_PHONE" | tr -cd '0-9')

while [[ ${#BOT_PHONE} -lt 10 || ! "$BOT_PHONE" =~ ^62 ]]; do
    echo -e "${RED}⚠️ Nomor tidak valid! Harus berawalan '62' dan minimal 10 digit.${NC}"
    read -rp "Ketik ulang nomor bot: " BOT_PHONE
    BOT_PHONE=$(echo "$BOT_PHONE" | tr -cd '0-9')
done
echo -e "${GREEN}✓ Nomor Bot terkonfirmasi: ${BOT_PHONE}${NC}\n"

# 4. Input Nomor Owner
echo -e "${BLUE}Nomor WhatsApp Owner Bot (Awali 62, bisa dipisah koma jika lebih dari satu):${NC}"
read -rp "Nomor Owner (Default: sama dengan nomor bot): " OWNER_INPUT
if [ -z "$OWNER_INPUT" ]; then
    OWNER_NUMBER="$BOT_PHONE"
else
    OWNER_NUMBER="$OWNER_INPUT"
fi
echo -e "${GREEN}✓ Nomor Owner: ${OWNER_NUMBER}${NC}\n"

# 5. Generate file .env
ENV_FILE=".env"
cat <<EOF > "$ENV_FILE"
# ==========================================
# KONFIGURASI OTOMATIS OLEH SETUP.SH
# ==========================================
SESSION_DIR=session_auth
PHONE_NUMBER=${BOT_PHONE}
OWNER_NUMBER=${OWNER_NUMBER}

# ==========================================
# DATABASE STORAGE DRIVER
# ==========================================
DB_DRIVER=${DB_DRIVER}
MONGODB_URI=${MONGODB_URI}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}

# ==========================================
# ANTI-SPAM COOLDOWN
# ==========================================
COMMAND_COOLDOWN_MS=1500
EOF

echo -e "${GREEN}✓ File .env berhasil dibuat!${NC}\n"

# 6. Install Dependencies
echo -e "${YELLOW}📦 Menginstal dependensi proyek...${NC}"
bun install --frozen-lockfile 2>/dev/null || bun install
echo -e "${GREEN}✓ Dependensi berhasil dipasang!${NC}\n"

# 8. Konfirmasi Jalankan Bot untuk Pairing
echo -e "${CYAN}======================================================${NC}"
echo -e "${GREEN}🎉 Setup Selesai!${NC}"
echo -e "Bot akan meminta kode pairing ke nomor ${YELLOW}${BOT_PHONE}${NC}."
echo -e "Silakan buka WhatsApp di HP Anda:"
echo -e "👉 ${YELLOW}Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon${NC}"
echo -e "${CYAN}======================================================${NC}\n"

read -rp "Jalankan bot sekarang untuk memunculkan kode pairing? (Y/n): " run_now
if [[ "$run_now" =~ ^[Nn]$ ]]; then
    echo -e "\nKetik ${CYAN}bun index.js${NC} kapan saja untuk menjalankan bot."
else
    echo -e "\n${YELLOW}Memulai bot dan meminta kode pairing...${NC}\n"
    exec bun index.js
fi
