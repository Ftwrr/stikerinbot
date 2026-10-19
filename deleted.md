# Arsip Lengkap Berkas & Fitur yang Dihapus (Deleted Features Manifest)

> **Basis Audit & Perbandingan:** Commit `ccffa13ddd0e4ad325d715741b313dfd3e284817` (Branch `main`)  
> **Tujuan Restrukturisasi:**  
> 1. Menghilangkan seluruh ketergantungan pada API eksternal berbayar (`api.zansxart.me`) agar bot 100% mandiri (*self-hosted*).  
> 2. Menghapus seluruh mekanisme komersialisasi/monetisasi (VIP/Premium, Sewa Grup, QRIS, Donasi, Kuota Limit, dan delay buatan) agar bot menjadi utilitas gratis, cepat, dan tanpa batas kuota.  
> 3. **Fitur Gamifikasi & Sosial (EXP, Leveling, Daily Claim & Leaderboard)** tetap **dipertahankan aktif** karena merupakan fitur interaktivitas pengguna murni dan tidak ada kaitannya dengan monetisasi.

---

## Ringkasan Perubahan Git (Status Diff terhadap ccffa13)

- **Total Berkas Dihapus (26 Berkas):**
  - 15 Berkas Fitur REST API Key (Zansxart)
  - 11 Berkas Sistem Kuota Limit, VIP/Premium, QRIS, Donasi & Sewa Grup
- **Total Berkas Dimodifikasi (13 Berkas):**
  - Pembersihan logika limit guard, scheduler background cron, dan konfigurasi API key.
  - `plugins/general/claim.js`: Diadaptasi menjadi klaim bonus 100 EXP harian (cooldown 24 jam).
  - `plugins/general/leaderboard.js`: Diadaptasi menjadi Top 10 Level & EXP murni.
- **Berkas Pengganti Baru (3 Berkas):**
  - `lib/spotify.js`: Scraper publik mandiri SpotMP3 & SpotSaver tanpa API key.
  - `plugins/downloader/spotify.js`: Plugin downloader Spotify independen.
  - `plugins/tools/profile.js`: Pengecekan profil, level, dan progres EXP (`.profile`, `.me`, `.level`, `.exp`).

---

## Tabel Rekapitulasi 26 Berkas yang Dihapus

| No | Path Berkas | Kategori | Tipe | Alasan Penghapusan |
|---|---|---|---|---|
| 1 | `lib/brat_generator.js` | Maker | Library | Wrapper pemanggil endpoint `/api/maker/brat` Zansxart. |
| 2 | `lib/game_manager.js` | Games | Library | State manager sesi kuis trivia online ke SQLite. |
| 3 | `lib/join_scheduler.js` | Group | Library | Cron scheduler masa sewa bot grup (countdown H-3 s/d auto-kick). |
| 4 | `lib/premium_scheduler.js` | General | Library | Cron scheduler masa aktif VIP/Premium (reset limit jika habis). |
| 5 | `lib/zans_downloader.js` | Downloader | Library | Scraper multi-sosmed yang bergantung pada endpoint Zansxart. |
| 6 | `plugins/ai/aivoice.js` | AI | Plugin | TTS Voice clone tokoh via Zansxart API. |
| 7 | `plugins/downloader/dl.js` | Downloader | Plugin | Downloader serbaguna (TT, IG, FB, X, YT, Pin) via Zansxart API. |
| 8 | `plugins/games/asahotak.js` | Games | Plugin | Kuis soal asah otak via Zansxart API. |
| 9 | `plugins/games/caklontong.js` | Games | Plugin | Kuis teka-teki logika Cak Lontong via Zansxart API. |
| 10 | `plugins/games/game_checker.js` | Games | Plugin | Watcher penangkap jawaban kuis online Zansxart. |
| 11 | `plugins/games/game_nyerah.js` | Games | Plugin | Perintah menyerah kuis dengan denda pemotongan 1 limit. |
| 12 | `plugins/games/tebakgambar.js` | Games | Plugin | Kuis gambar tebak-tebakan via Zansxart API. |
| 13 | `plugins/general/buylimit.js` | General | Plugin | Pembelian kuota limit perintah via EXP. |
| 14 | `plugins/general/donasi.js` | General | Plugin | Menampilkan barcode QRIS donasi via `src/donasi.png`. |
| 15 | `plugins/general/premium.js` | General | Plugin | Manajemen akun VIP/Premium & info paket Rp 7k/bulan. |
| 16 | `plugins/general/qris.js` | General | Plugin | Informasi sewa bot grup dan pemesanan premium via QRIS. |
| 17 | `plugins/maker/brat.js` | Maker | Plugin | Pembuat stiker teks Brat via Zansxart API. |
| 18 | `plugins/maker/bratvid.js` | Maker | Plugin | Pembuat video animasi teks Brat via Zansxart API. |
| 19 | `plugins/maker/hd.js` | Maker | Plugin | Upscale foto buram via Zansxart API & temporary upload. |
| 20 | `plugins/maker/iqc.js` | Maker | Plugin | Fake chat iPhone / iMessage bubble via Zansxart API. |
| 21 | `plugins/maker/qc.js` | Maker | Plugin | Fake quote chat stiker WhatsApp via Zansxart API. |
| 22 | `plugins/maker/removebg.js` | Maker | Plugin | Hapus latar belakang foto via Zansxart API & upload temp. |
| 23 | `plugins/tools/limit.js` | Tools | Plugin | Cek kuota limit (digantikan oleh `plugins/tools/profile.js`). |
| 24 | `plugins/tools/ocr.js` | Tools | Plugin | Ekstraksi teks foto dokumen via Zansxart API. |
| 25 | `plugins/tools/stalk.js` | Tools | Plugin | Stalker profil game & medsos via Zansxart API. |
| 26 | `src/donasi.png` | General | Media | Berkas PNG barcode QRIS pembayaran donasi dan sewa. |

---

## Status Fitur Gamifikasi (EXP, Leveling, Daily Claim & Leaderboard)

Fitur-fitur interaktif berikut **tetap aktif dan fungsional**:
1. **Perolehan EXP & Notifikasi Level Up**:
   - Lokasi: `lib/plugin_manager.js`
   - Setiap pengguna menjalankan perintah bot, user mendapatkan acak 1-9 EXP.
   - Ambang level up: `user.exp >= user.level * 1000`. Saat naik level, bot mengirimkan ucapan selamat naik level.
2. **Klaim Bonus Harian (Daily Claim)**:
   - Lokasi: `plugins/general/claim.js` (`.claim`, `.daily`, `.klaim`, `.hadiah`)
   - Memberikan bonus **+100 EXP** sekali setiap 24 jam dengan timer countdown cooldown.
3. **Leaderboard Level & EXP**:
   - Lokasi: `plugins/general/leaderboard.js` (`.lb`, `.leaderboard`, `.rank`, `.top`, `.toplevel`)
   - Menampilkan peringkat 10 besar pengguna teraktif berdasarkan Level tertinggi dan akumulasi EXP.
4. **Pengecekan Profil Pengguna**:
   - Lokasi: `plugins/tools/profile.js` (`.profile`, `.me`, `.level`, `.exp`)
   - Menampilkan Nama, Role, Level, dan persentase progres EXP menuju level berikutnya.

---

## Rincian Mendalam 26 Berkas yang Dihapus

### 1. Kategori: AI & Voice
#### `plugins/ai/aivoice.js`
- **Perintah:** `.aivoice`, `.vnai`, `.suaraai`
- **Deskripsi:** Mengubah teks menjadi Voice Note WhatsApp (PTT) meniru suara tokoh terkenal (Jokowi, Prabowo, Megawati, Anies, Onah).
- **Endpoint:** `GET https://api.zansxart.me/api/ai/aivoice?character={tokoh}&text={teks}`
- **Alasan Hapus:** Menggunakan API Key berbayar.
- **Blueprint Rekonstruksi:** Gunakan `google-tts-api` lokal atau `edge-tts` (Microsoft Edge neural voice) yang gratis tanpa API key.

---

### 2. Kategori: Downloader Media Sosial
#### `plugins/downloader/dl.js`
- **Perintah:** `.dl`, `.download`, `.tt`, `.tiktok`, `.ig`, `.instagram`, `.fb`, `.facebook`, `.tw`, `.twitter`, `.x`, `.capcut`, `.pin`, `.pindl`, `.yt`, `.ytmp3`, `.ytmp4`, `.youtube`
- **Deskripsi:** Pengunduh media serbaguna dari berbagai platform sosial.
- **File Pendukung:** `lib/zans_downloader.js`
- **Endpoint:**
  - Instagram: `GET /api/download/instagram`
  - TikTok: `GET /api/download/tiktok` & `/api/download/douyin`
  - Facebook: `GET /api/download/facebook`
  - Twitter/X: `GET /api/download/twitter`
  - CapCut: `GET /api/download/capcut`
  - Pinterest: `GET /api/download/pindl`
  - YouTube: `GET /api/download/ytmp4`
  - All-in-One: `GET /api/download/aio`
- **Alasan Hapus:** Ketergantungan API key pada `api.zansxart.me`.
- **Catatan:** Spotify downloader tidak ikut hilang, melainkan telah dipisahkan ke `lib/spotify.js` dan `plugins/downloader/spotify.js` menggunakan scraper publik mandiri.
- **Blueprint Rekonstruksi:** Integrasikan modul mandiri per platform (TikWM untuk TikTok, Cobalt Tools API publik, atau binary `yt-dlp` lokal).

#### `lib/zans_downloader.js`
- **Deskripsi:** Library router yang membungkus seluruh HTTP request ke endpoint downloader Zansxart.

---

### 3. Kategori: Maker & Media Editing
#### `plugins/maker/brat.js` & `lib/brat_generator.js`
- **Perintah:** `.b`, `.brat`
- **Deskripsi:** Menghasilkan stiker teks bergaya album Brat (latar hijau limau dengan teks font Arial buram).
- **Endpoint:** `GET https://api.zansxart.me/api/maker/brat?text={teks}`
- **Blueprint Rekonstruksi:** Render gambar lokal 512x512 via `@napi-rs/canvas` atau `skia-canvas`, lalu konversi ke WebP menggunakan engine `lib/converter.js` lokal.

#### `plugins/maker/bratvid.js`
- **Perintah:** `.bratvid`, `.bratvideo`
- **Deskripsi:** Menghasilkan animasi video kata-per-kata bergaya Brat dan diubah menjadi stiker WebP bergerak.
- **Endpoint:** `GET https://api.zansxart.me/api/maker/bratvideo?text={teks}`
- **Blueprint Rekonstruksi:** Susun frame kata per frame lokal menggunakan Canvas, gabungkan ke format MP4 via FFmpeg loop.

#### `plugins/maker/qc.js`
- **Perintah:** `.qc`, `.qcc`
- **Deskripsi:** Membuat stiker tiruan gelembung chat WhatsApp yang memuat foto profil, nama, dan teks target.
- **Endpoint:** `GET https://api.zansxart.me/api/maker/qc?text={teks}&name={nama}&avatar={url}&color=%23202c33`
- **Blueprint Rekonstruksi:** Template SVG/Canvas lokal atau manfaatkan API quote maker publik gratis.

#### `plugins/maker/iqc.js`
- **Perintah:** `.iqc`
- **Deskripsi:** Membuat tiruan tangkapan layar chat gelembung pesan iMessage / iPhone.
- **Endpoint:** `GET https://api.zansxart.me/api/maker/iqc?text={teks}&chatTime={jam}&statusBarTime={jam}`
- **Blueprint Rekonstruksi:** Template HTML/CSS to Image lokal.

#### `plugins/maker/hd.js`
- **Perintah:** `.hd`, `.remini`, `.upscale`
- **Deskripsi:** Meningkatkan resolusi gambar buram menjadi HD (2x atau 4x).
- **Alur:** Upload buffer ke `catbox.moe` / `uguu.se` -> panggil `GET /api/tools/upscale?url={url}&scale={2/4}`.
- **Blueprint Rekonstruksi:** Eksekusi binary portabel Real-ESRGAN atau Waifu2x lokal di server.

#### `plugins/maker/removebg.js`
- **Perintah:** `.removebg`, `.nobg`, `.hapusbg`
- **Deskripsi:** Menghapus latar belakang gambar menjadi transparan.
- **Alur:** Upload buffer ke `catbox.moe` / `uguu.se` -> panggil `GET /api/tools/removebg?url={url}`.
- **Blueprint Rekonstruksi:** Gunakan library segmentasi AI lokal `@imgly/background-removal-node`.

---

### 4. Kategori: Permainan Kuis & Trivia
#### `plugins/games/asahotak.js`
- **Perintah:** `.asahotak`, `.ao`
- **Endpoint:** `GET https://api.zansxart.me/api/game/asahotak`
- **Data:** `{ soal, jawaban, poin }`
- **Blueprint Rekonstruksi:** Pindahkan bank soal ke berkas JSON statis lokal (`db/games/asahotak.json`).

#### `plugins/games/caklontong.js`
- **Perintah:** `.caklontong`, `.kuislontong`
- **Endpoint:** `GET https://api.zansxart.me/api/game/caklontong`
- **Data:** `{ soal, jawaban, deskripsi, poin }`
- **Blueprint Rekonstruksi:** Pindahkan bank teka-teki Cak Lontong ke berkas JSON statis lokal (`db/games/caklontong.json`).

#### `plugins/games/tebakgambar.js`
- **Perintah:** `.tebakgambar`, `.tg`
- **Endpoint:** `GET https://api.zansxart.me/api/game/tebakgambar`
- **Data:** `{ img, jawaban, deskripsi, poin }`
- **Blueprint Rekonstruksi:** Pindahkan kumpulan gambar dan kunci jawaban ke berkas JSON statis lokal.

#### `plugins/games/game_checker.js`
- **Deskripsi:** Handler watcher non-command (`custom: true`) yang memvalidasi teks chat terhadap `game.jawaban` dari 3 kuis online di atas.
- **Alasan Hapus:** Bergantung pada 3 kuis online Zansxart.

#### `plugins/games/game_nyerah.js`
- **Perintah:** `.nyerah`, `.menyerah`, `.surrender`
- **Deskripsi:** Menyerah dari kuis yang sedang aktif dengan sanksi denda 1 limit.
- **Alasan Hapus:** Terikat dengan 3 kuis online dan sistem limit.

#### `lib/game_manager.js`
- **Deskripsi:** Menyimpan state kuis aktif ke tabel SQLite `games` dan melakukan auto-restore saat bot booting ulang.

---

### 5. Kategori: Tools & Stalker
#### `plugins/tools/ocr.js`
- **Perintah:** `.ocr`, `.totext`, `.imagetotext`
- **Deskripsi:** Mengekstrak teks dari foto dokumen atau gambar.
- **Alur:** Upload ke `catbox.moe` -> panggil `GET /api/tools/ocr?url={url}`.
- **Blueprint Rekonstruksi:** Gunakan library offline `tesseract.js` di Node.js.

#### `plugins/tools/stalk.js`
- **Perintah:** `.stalk` (sub-command: `ff`, `mlbb`, `genshin`, `roblox`, `tiktok`)
- **Endpoint:**
  - Free Fire: `/api/stalker/ff`
  - Mobile Legends: `/api/stalker/mlbb`
  - Genshin Impact: `/api/stalker/genshin`
  - Roblox: `/api/stalker/roblox`
  - TikTok: `/api/stalker/tiktok`
- **Blueprint Rekonstruksi:** Manfaatkan API publik order voucher (Codashop / DuniaGames API) untuk cek ID nickname game secara gratis.

---

### 6. Kategori: Sistem Limit, VIP, QRIS, Donasi & Sewa
#### `plugins/general/buylimit.js`
- **Perintah:** `.buylimit`, `.belilimit`, `.buyl`, `.belil`
- **Deskripsi:** Menukarkan 200 poin EXP game menjadi 1 Limit kuota perintah.
- **Alasan Hapus:** Seluruh fitur bot sekarang bebas limit (unlimited) untuk semua user.

#### `plugins/tools/limit.js`
- **Perintah:** `.limit`, `.ceklimit`
- **Deskripsi:** Menampilkan rincian sisa kuota limit akun.
- **Alasan Hapus:** Digantikan oleh `plugins/tools/profile.js` yang berfokus murni pada Profil, Level, dan Progres EXP.

#### `plugins/general/premium.js`
- **Perintah:** `.premium`, `.prem`
- **Deskripsi:** Sistem membership VIP/Premium berbayar Rp 7.000/bulan untuk mendapatkan status bebas limit dan bebas delay di chat pribadi.
- **Alasan Hapus:** Semua pengguna kini otomatis mendapatkan akses instan tanpa batas dan tanpa biaya.

#### `lib/premium_scheduler.js`
- **Deskripsi:** Background cron setiap 1 menit yang memeriksa `user.premiumTime`. Mengirim pesan peringatan H-3 dan mencabut status premium (mengembalikan limit ke 50) saat kedaluwarsa.
- **Alasan Hapus:** Membership VIP ditiadakan.

#### `plugins/general/qris.js`
- **Perintah:** `.qris`, `.sewa`, `.sewabot`, `.topup`, `.beliprem`, `.orderprem`
- **Deskripsi:** Daftar tarif sewa bot masuk grup (1 hari Rp 2k, 7 hari Rp 5k, 30 hari Rp 15k) dan upgrade premium dengan instruksi pembayaran manual via QRIS.
- **Alasan Hapus:** Fitur komersialisasi dan sewa bot ditiadakan.

#### `plugins/general/donasi.js`
- **Perintah:** `.donasi`, `.donate`, `.dukung`
- **Deskripsi:** Mengirim barcode QRIS donasi dari `src/donasi.png`.
- **Alasan Hapus:** Pembersihan materi pembayaran dan tautan komersial.

#### `src/donasi.png`
- **Deskripsi:** Berkas gambar statis QRIS barcode pembayaran.

#### `lib/join_scheduler.js`
- **Deskripsi:** Background cron yang memeriksa masa aktif sewa bot di grup (`chatData.joinExpiry`). Menghitung mundur (H-3, H-2, H-1, 1 jam, 1 menit) dan memerintahkan bot keluar grup (`groupLeave`) secara otomatis saat masa sewa berakhir.
- **Alasan Hapus:** Bot tidak lagi memakai sistem sewa berbayar dengan batas waktu otomatis keluar.

---

## Rincian Perubahan pada 13 Berkas yang Dimodifikasi

### 1. `lib/plugin_manager.js`
- **Dihapus:** Pengurangan kuota limit per eksekusi perintah (`user.limit -= limitCost`).
- **Dihapus:** Pemblokiran perintah jika limit habis ("*Limit Kamu Habis!*") beserta tombol beli limit / beli premium.
- **Dihapus:** Jeda delay buatan 5 detik (`PC_DELAY_MS`) untuk free user di chat pribadi.
- **Dipertahankan:** Penambahan random EXP (1-9) dan notifikasi "*LEVEL UP!*" saat mencapai ambang `user.exp >= user.level * 1000`.
- **Dihapus:** Teks ajakan buka unban instan via bayar QRIS Rp 2.000 pada pesan akun dibanned.
- **Dihapus:** Pengecekan `isFreeLimitChat` dan hak akses `plugin.premium`.

### 2. `plugins/general/claim.js`
- **Dimodifikasi:** Diubah dari klaim kuota limit menjadi klaim bonus **+100 EXP harian** (cooldown 24 jam) dengan pengecekan kenaikan level otomatis.

### 3. `plugins/general/leaderboard.js`
- **Dimodifikasi:** Disederhanakan menjadi Leaderboard Level & EXP murni (Top 10 Pengguna teraktif), menghapus mode sorting berdasarkan limit kuota dan badge VIP.

### 4. `lib/settings.js`
- **Dihapus:** Fungsi `isFreeLimitChat(m)` yang sebelumnya memeriksa apakah grup memiliki nama `stikerin`, status sewa grup aktif, atau JID grup resmi tertentu.

### 5. `plugins/owner/join.js`
- **Dimodifikasi:** Menghapus parameter durasi hari (`parseDays`) dan pembuatan timer masa sewa (`chatData.joinExpiry`). Bot kini masuk ke grup secara permanen atas instruksi Owner tanpa auto-kick.

### 6. `index.js`
- **Dihapus:** Import dan inisialisasi `startPremiumExpiryScheduler` dan `startJoinExpiryScheduler`.
- **Dihapus:** Pemanggilan pemulihan kuis aktif `restoreActiveGames` dari `lib/game_manager.js`.
- **Dihapus:** Teks penawaran unban via QRIS Rp 2.000 pada listener Anti-Call.
- **Dihapus:** Dead code fungsi `handleBratCommand` (baris 329-359) yang memuat URL hardcoded `stikerin.my.id/api/v1/brat?apikey=...`.

### 7. `lib/jadibot_zapo.js`
- **Dihapus:** Teks penawaran unban berbayar via QRIS Rp 2.000 pada penolakan panggilan sub-bot (Anti-Call).

### 8. `lib/config.js`
- **Dihapus:** Pendaftaran default provider `zans: 'https://api.zansxart.me'` pada `global.APIs` dan pemetaan `global.APIKeys`.

### 9. `plugins/general/menu.js`
- **Dihapus:** Footer promosi `Supported & Powered by https://api.zansxart.me`.
- **Dimodifikasi:** Menyesuaikan tombol navigasi menu (`.claim` untuk Klaim Harian EXP).

### 10. `.env.example`
- **Dihapus:** Variabel konfigurasi `ZANS_API_KEY` dan delay pribadi `PC_DELAY_MS=5000`.

### 11. `setup.sh`
- **Dihapus:** Tahap input interaktif nomor 5 untuk Zans API Key.
- **Dihapus:** Injeksi variabel `ZANS_API_KEY` dan `PC_DELAY_MS` ke file `.env` yang dihasilkan.

### 12. `package.json`
- **Ditambahkan:** `@zapo-js/media-utils` dan `form-data` ke `dependencies` resmi untuk memperbaiki error module resolution pada pnpm/bun.

### 13. `.gitignore`
- **Diperbaiki:** Format baris rusak `sessions# Node.js Modules` menjadi baris terpisah yang valid.
- **Ditambahkan:** `.pnpm-store/`, file log pnpm, file temporary watcher reload `._tmp_*`, dan folder sesi default `session_auth/`.
