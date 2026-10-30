# 🤖 WhatsApp Moderator Bot - GBI Jelambar Timur

Bot otomatis khusus untuk **Moderator / Super Admin** guna memantau aktivitas sistem, kehadiran ibadah, absensi komisi, audit perubahan data, dan kesehatan server secara realtime 24/7 langsung dari WhatsApp.

---

## 🔒 Fitur Keamanan (Whitelist Ketat)
Bot ini **hanya dapat diakses dan merespons satu nomor moderator**:
* **Nomor Terdaftar:** `+62 878-7766-1161` (Maryellen Eunike)
* Jika ada nomor lain yang mengirim pesan, bot akan otomatis menolak akses demi privasi dan keamanan data gereja.

---

## 📋 Daftar Perintah Bot

| Perintah / Shortcut | Fungsi |
| :--- | :--- |
| `menu` / `help` | Menampilkan Menu Utama pemantauan |
| `1` atau `ringkasan` | Menampilkan ringkasan hari ini (total jemaat, total hadir, edit 24 jam) |
| `2` atau `absen umum` | Menampilkan 7 sesi ibadah umum terakhir & jumlah hadir |
| `absen YYYY-MM-DD` | Menampilkan detail nama jemaat yang hadir pada tanggal tersebut (contoh: `absen 2026-10-27`) |
| `3` atau `absen komisi` | Menampilkan kehadiran tiap komisi (Youth, WBI, Teens, Kompas, dll) |
| `4` atau `log` | Menampilkan riwayat perubahan data sensitif terbaru (contoh: edit nama Budi ➡️ Bude) |
| `5` atau `error` | Memeriksa latency database Neon & rekap error sistem |
| `6` atau `notif on` / `notif off` | Mengatur notifikasi otomatis (Push Alert) saat ada perubahan data baru |

---

## 🚨 Push Notification Otomatis
Bot ini memiliki background watcher yang aktif setiap **45 detik**:
* Jika ada admin yang mengubah data jemaat atau terjadi kendala sistem di website admin dashboard, bot akan **langsung mengirim pesan peringatan (alert)** ke nomor WhatsApp Anda tanpa perlu diminta!

---

## 🚀 Cara Menjalankan Bot

Jalankan perintah berikut di terminal:
```bash
npm run bot:wa
```
1. Pada terminal akan muncul **QR Code WhatsApp**.
2. Buka aplikasi WhatsApp di HP Anda > **Perangkat Tertaut (Linked Devices)** > **Tautkan Perangkat**.
3. Scan QR Code tersebut sekali saja.
4. Bot akan otomatis aktif dan terhubung langsung ke database Neon PostgreSQL gereja!
