# Stikerin Bot 🚀

Bot WhatsApp modern, ringan, dan cepat berbasis engine **zapo-js** dengan runtime **Bun**, difokuskan untuk integrasi fitur REST API **[api.zansxart.me](https://api.zansxart.me)**.

<p align="center">
  <a href="https://saweria.co/ariffb" target="_blank">
    <img src="https://img.shields.io/badge/Saweria-Dukung%20Kreator-orange?style=for-the-badge&logo=coffee" alt="Dukung via Saweria" />
  </a>
</p>

---

## ⚡ Instalasi Cepat (Rekomendasi)

Gunakan wizard instalasi interaktif untuk setup database, nomor bot, dan langsung memunculkan kode pairing WhatsApp:

```bash
bash setup.sh
```
*(atau via `bun run setup`)*

Wizard akan memandu Anda untuk:
1. Memilih adapter database (`SQLite`, `MongoDB`, atau `Supabase`).
2. Memasukkan nomor WhatsApp bot (format: `628xxxxxxxxxx`).
3. Memasukkan nomor WhatsApp Owner & API Key Zansxart.
4. Menghasilkan file `.env` otomatis dan memunculkan **Kode Pairing 8 Karakter** di terminal.

---

## 🛠️ Instalasi Manual

### 1. Kebutuhan Sistem (OS Linux / Ubuntu / Debian)
- [Bun](https://bun.sh) (v1.2+)
- `ffmpeg` (Pengolahan audio & video)
- `libwebp-tools` & `imagemagick` (Konversi stiker WebP)
- `pm2` (Opsional, untuk process supervisor di production)

```bash
sudo apt update && sudo apt install -y ffmpeg webp imagemagick
```

### 2. Pasang Dependensi
```bash
bun install
```

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` ke `.env`:
```bash
cp .env.example .env
```

Contoh isi `.env`:
```env
SESSION_DIR=session_auth
PHONE_NUMBER=6281234567890
OWNER_NUMBER=6281234567890

# Database Driver: sqlite | mongodb | supabase
DB_DRIVER=sqlite

# API Key dari https://api.zansxart.me
ZANS_API_KEY=your_api_key_here

PC_DELAY_MS=5000
COMMAND_COOLDOWN_MS=1500
```

---

## 📲 Menghubungkan Bot ke WhatsApp (Pairing Code)

1. Jalankan bot:
   ```bash
   bun index.js
   ```
2. Kode pairing 8 karakter akan muncul di terminal (contoh: `ABCD-1234`).
3. Buka WhatsApp di ponsel Anda:
   - Ketuk menu titik tiga (⋮) atau **Pengaturan**.
   - Pilih **Perangkat Tertaut** > **Tautkan Perangkat**.
   - Pilih **Tautkan dengan nomor telepon saja**.
   - Masukkan 8 karakter kode pairing dari terminal.
4. Bot berhasil terhubung dan siap digunakan!

---

## 🚀 Menjalankan Bot

### Mode Development
```bash
# Menjalankan langsung
bun index.js

# Mode auto-reload saat edit file
bun dev
```

### Pemasangan Production (PM2)
```bash
# Menjalankan via PM2
pm2 start ecosystem.config.cjs

# Simpan state agar auto-start saat VPS reboot
pm2 save
pm2 startup

# Monitoring log real-time
pm2 logs stikerinbot
```

### Menjalankan Unit Test
```bash
bun test
```

---

## 👥 Pengaturan Grup (Welcome, Leave, Promote, Demote)
Bot mendukung template kustom notifikasi keanggotaan grup (khusus Admin grup):
- `.setwelcome <teks>` : Mengatur teks sambutan member baru
- `.setleave <teks>` : Mengatur teks ucapan member keluar/dikeluarkan
- `.setpromote <teks>` : Mengatur notifikasi member diangkat jadi Admin
- `.setdemote <teks>` : Mengatur notifikasi Admin diturunkan pangkat

*Placeholder variabel yang didukung:*
- `@user` : Tag member bersangkutan
- `@subject` : Nama/judul grup
- `@desc` : Deskripsi grup

---

## 📄 Lisensi
Proyek ini dilisensikan di bawah lisensi [MIT](LICENSE).
