# TODO: Daftar Fitur Ketergantungan API Key (Zansxart API)

Dokumen ini mencatat seluruh fitur dan file yang bergantung pada REST API pihak ketiga (`https://api.zansxart.me` via `ZANS_API_KEY`) sebelum dihapus dari bot, agar dapat diimplementasikan kembali di masa depan menggunakan scraper mandiri, library lokal, atau alternatif gratis tanpa API key.

---

## 1. Kategori: AI & Voice

### A. AI Voice Clone (TTS Tokoh)
- **File:** `plugins/ai/aivoice.js`
- **Command:** `.aivoice`, `.vnai`, `.suaraai`
- **Endpoint:** `GET https://api.zansxart.me/api/ai/aivoice`
- **Parameter:**
  - `character`: `Jokowi` | `Prabowo` | `Megawati` | `Anies` | `Onah`
  - `text`: string teks yang akan diucapkan (maksimal 250 karakter)
- **Output:** Buffer Audio (MPEG/MP3) yang dikonversi menjadi WhatsApp Voice Note (PTT).
- **Rencana Pengganti di Masa Depan:** Menggunakan library Text-to-Speech lokal (misal: Google TTS via `google-tts-api` / edge-tts) atau voice model self-hosted.

---

## 2. Kategori: Maker & Media Editing

### A. Brat Typography Sticker

- **File:** `plugins/maker/brat.js` & `lib/brat_generator.js`
- **Command:** `.b`, `.brat`
- **Endpoint:** `GET https://api.zansxart.me/api/maker/brat`
- **Parameter:** `text` (maksimal 120 karakter)
- **Output:** Buffer Gambar PNG -> dikonversi ke WebP stiker dengan EXIF pack `stikerin.my.id`.
- **Rencana Pengganti di Masa Depan:** Generate gambar stiker Brat secara lokal menggunakan Canvas (e.g. `skia-canvas` / `@napi-rs/canvas`) dengan font Arial / Helvetica blurry khas Brat.

### B. Brat Animated Video
- **File:** `plugins/maker/bratvid.js`
- **Command:** `.bratvid`, `.bratvideo`
- **Endpoint:** `GET https://api.zansxart.me/api/maker/bratvideo`
- **Parameter:** `text`
- **Output:** Video animasi teks per kata (MP4) -> dikonversi menjadi stiker bergerak/video WebP.
- **Rencana Pengganti di Masa Depan:** Render animasi teks lokal per kata via Canvas + FFmpeg.

### C. Quote Chat (QC)
- **File:** `plugins/maker/qc.js`
- **Command:** `.qc`, `.qcc`
- **Endpoint:** `GET https://api.zansxart.me/api/maker/qc`
- **Parameter:**
  - `text`: Teks pesan
  - `name`: Nama pengirim / pushName
  - `avatar`: URL foto profil pengirim
  - `color`: `#202c33`
- **Output:** Gambar stiker fake bubble chat WhatsApp.
- **Rencana Pengganti di Masa Depan:** Scraping API Quote Maker publik gratis (misal: botcahx / sonv-api) atau template SVG/Canvas lokal.

### D. Fake Chat iPhone (iQC)
- **File:** `plugins/maker/iqc.js`
- **Command:** `.iqc`
- **Endpoint:** `GET https://api.zansxart.me/api/maker/iqc`
- **Parameter:**
  - `text`: Pesan chat
  - `chatTime`: Jam (format `HH.mm`)
  - `statusBarTime`: Jam status bar
- **Output:** Gambar chat iOS / iMessage bubble.
- **Rencana Pengganti di Masa Depan:** Generator Canvas HTML/CSS to image lokal menggunakan template tampilan iOS.

### E. Upscale Gambar HD (Remini)
- **File:** `plugins/maker/hd.js`
- **Command:** `.hd`, `.remini`, `.upscale`
- **Endpoint:** `GET https://api.zansxart.me/api/tools/upscale`
- **Alur Kerja:**
  1. Download media gambar dari chat WhatsApp.
  2. Upload sementara ke uploader publik (`catbox.moe` / `uguu.se`).
  3. Kirim URL gambar ke endpoint upscale Zansxart (`url`, `scale=2` atau `scale=4`).
  4. Unduh kembali hasil gambar beresolusi tinggi.
- **Rencana Pengganti di Masa Depan:** Menggunakan Upscaler gratis (AI Waifu2x lokal / Real-ESRGAN portable binary atau API publik bebas apikey).

### F. Hapus Background (Remove BG)
- **File:** `plugins/maker/removebg.js`
- **Command:** `.removebg`, `.nobg`, `.hapusbg`
- **Endpoint:** `GET https://api.zansxart.me/api/tools/removebg`
- **Alur Kerja:**
  1. Upload sementara foto ke `catbox.moe` / `uguu.se`.
  2. Panggil API Zansxart dengan query parameter `url`.
  3. Kirim hasil PNG transparan ke user.
- **Rencana Pengganti di Masa Depan:** Menggunakan model segmentation AI lokal (misal: `@imgly/background-removal-node` / rembg) atau API gratis tanpa token.

---

## 3. Kategori: Downloader Media Sosial

### A. Universal Social Media Downloader
- **File:** `plugins/downloader/dl.js` & `lib/zans_downloader.js`
- **Command:** `.dl`, `.download`, `.tt`, `.tiktok`, `.ig`, `.instagram`, `.fb`, `.facebook`, `.tw`, `.twitter`, `.x`, `.capcut`, `.pin`, `.pindl`, `.yt`, `.ytmp3`, `.ytmp4`, `.youtube`
- **Endpoints yang Digunakan:**
  - Instagram: `GET /api/download/instagram?url=...`
  - TikTok / Douyin: `GET /api/download/tiktok?url=...` & `GET /api/download/douyin?url=...`
  - Facebook: `GET /api/download/facebook?url=...`
  - Twitter / X: `GET /api/download/twitter?url=...`
  - CapCut: `GET /api/download/capcut?url=...`
  - Pinterest: `GET /api/download/pindl?url=...`
  - YouTube: `GET /api/download/ytmp4?url=...`
  - All-in-One Fallback: `GET /api/download/aio?url=...`
- **Catatan:** Spotify sudah dipisahkan ke `lib/spotify.js` dan `plugins/downloader/spotify.js` tanpa ketergantungan API key.
- **Rencana Pengganti di Masa Depan:** Memanfaatkan library scraper mandiri (misal: `@vitalets/google-translate-api`, `yt-dlp` binary, cheerio-based scraper web, atau modul downloader terpisah per platform seperti tikwm, cobalt.tools API).

---

## 4. Kategori: Game Kuis

### A. Asah Otak
- **File:** `plugins/games/asahotak.js`
- **Command:** `.asahotak`, `.ao`
- **Endpoint:** `GET https://api.zansxart.me/api/game/asahotak`
- **Output:** `{ soal, jawaban, poin }`
- **Rencana Pengganti di Masa Depan:** Simpan database soal statis dalam file lokal JSON (`src/games/asahotak.json`).

### B. Cak Lontong
- **File:** `plugins/games/caklontong.js`
- **Command:** `.caklontong`, `.kuislontong`
- **Endpoint:** `GET https://api.zansxart.me/api/game/caklontong`
- **Output:** `{ soal, jawaban, deskripsi, poin }`
- **Rencana Pengganti di Masa Depan:** Simpan kumpulan tebak-tebakan Cak Lontong dalam file lokal JSON (`src/games/caklontong.json`).

### C. Tebak Gambar
- **File:** `plugins/games/tebakgambar.js`
- **Command:** `.tebakgambar`, `.tg`
- **Endpoint:** `GET https://api.zansxart.me/api/game/tebakgambar`
- **Output:** `{ img, jawaban, deskripsi, poin }`
- **Rencana Pengganti di Masa Depan:** Simpan kumpulan link/file gambar tebak gambar dalam file lokal JSON (`src/games/tebakgambar.json`).

---

## 5. Kategori: Tools & Stalker

### A. OCR (Image-to-Text)
- **File:** `plugins/tools/ocr.js`
- **Command:** `.ocr`, `.totext`, `.imagetotext`
- **Endpoint:** `GET https://api.zansxart.me/api/tools/ocr?url=...`
- **Rencana Pengganti di Masa Depan:** Gunakan `tesseract.js` lokal untuk menjalankan OCR secara offline di CPU tanpa perlu upload ke server mana pun.

### B. Game & Medsos Stalker
- **File:** `plugins/tools/stalk.js`
- **Command:** `.stalk` (`ff`, `mlbb`, `genshin`, `roblox`, `tiktok`)
- **Endpoints:**
  - Free Fire: `GET /api/stalker/ff?id=...`
  - Mobile Legends: `GET /api/stalker/mlbb?id=...&zoneId=...`
  - Genshin Impact: `GET /api/stalker/genshin?uid=...`
  - Roblox: `GET /api/stalker/roblox?username=...`
  - TikTok: `GET /api/stalker/tiktok?username=...`
- **Rencana Pengganti di Masa Depan:** Menggunakan API publik topup store (seperti DuniaGames, Codashop, Unipin API) untuk lookup nickname game secara gratis.

---

## 6. File Inti & Library yang Terkait Zansxart

Saat membersihkan ketergantungan API key, file-file berikut juga perlu disesuaikan:

1. `lib/config.js`:
   - Hapus `global.APIs` dan `global.APIKeys` yang mereferensikan `api.zansxart.me`.
   - Hapus fungsi builder `global.API()`.
2. `lib/api_client.js`:
   - Helper universal axios untuk Zansxart.
3. `lib/brat_generator.js`:
   - Wrapper pemanggil `/api/maker/brat`.
4. `lib/zans_downloader.js`:
   - Wrapper seluruh fungsi downloader sosmed Zansxart.
5. `setup.sh` & `.env.example`:
   - Hapus prompt dan variabel konfigurasi `ZANS_API_KEY`.
6. `plugins/general/menu.js`:
   - Hapus teks footer promosi `api.zansxart.me`.
7. `index.js`:
   - Hapus fungsi mati (dead code) `handleBratCommand` (baris 329-360) yang mengandung URL `stikerin.my.id/api/v1/brat?apikey=...`.
