# Stikerin Bot 🚀

Bot WhatsApp modern, ringan, dan cepat berbasis engine **zapo-js** dengan runtime **Bun**, difokuskan untuk integrasi fitur REST API **[api.zansxart.me](https://api.zansxart.me)**.

<p align="center">
  <a href="https://saweria.co/ariffb" target="_blank">
    <img src="https://img.shields.io/badge/Saweria-Dukung%20Kreator-orange?style=for-the-badge&logo=coffee" alt="Dukung via Saweria" />
  </a>
</p>

---

## ⚡ Dependensi yang Diperlukan

### 1. Kebutuhan Sistem (OS Linux / Ubuntu / Debian)
- [Bun](https://bun.sh) versi terbaru (v1.4.2)
- `ffmpeg` (Pengolahan audio & video)
- `libwebp-tools` & `imagemagick` (Konversi stiker WebP)
- `pm2` (Process manager untuk production)

Perintah instalasi paket sistem:
```bash
sudo apt update && sudo apt install -y ffmpeg webp imagemagick
npm install -g pm2
```

### 2. Dependensi Node/Bun
Instal dependensi project dengan Bun:
```bash
bun install
```

---

## ⚙️ Konfigurasi Environment

Salin atau rename file `.env.example` menjadi `.env`, lalu sesuaikan isinya:
```bash
cp .env.example .env
```

Isi konfigurasi pada file `.env`:
```env
SESSION_DIR=session_auth
OWNER_NUMBER=628xxxxxxxxxx
ZANS_API_KEY=your_api_key_here
```

---

## 🚀 Menjalankan Bot

### Mode Development
```bash
# Menjalankan langsung
bun index.js

# Mode auto-reload
bun dev
```

### Pemasangan Production via PM2
Gunakan `ecosystem.config.cjs` yang sudah dikonfigurasi menggunakan interpreter Bun:
```bash
# Start bot via PM2
pm2 start ecosystem.config.cjs

# Simpan state PM2 agar auto-start saat reboot
pm2 save
pm2 startup

# Monitoring log
pm2 logs stikerinbot
```

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi [MIT](LICENSE).
