# Retro Chatbot 8-Bit (Lightweight untuk Server Ubuntu)

Proyek ini adalah aplikasi chatbot web yang sangat ringan, didesain khusus untuk berjalan pada server Ubuntu dengan spesifikasi terbatas (seperti RAM ~1GB dan Storage kecil).

Aplikasi ini menggunakan:
- **Backend:** Python + Flask (sangat ringan dan tidak memakan banyak RAM)
- **Frontend:** HTML, CSS murni, dan Vanilla JavaScript (desain retro 8-bit bergaya terminal jadul)
- **AI Engine:** Google Gemini API (model `gemini-1.5-flash`). Karena kita menggunakan API, server Anda tidak perlu melakukan komputasi berat, semua pemrosesan AI ditangani oleh server Google.
- **Stateless:** Sesuai permintaan, aplikasi ini tidak menyimpan riwayat obrolan (chat history). Jika halaman direfresh, obrolan sebelumnya akan hilang.

---

## Panduan Instalasi dan Menjalankan di Server Ubuntu

Ikuti langkah-langkah di bawah ini untuk menjalankan aplikasi ini di server Ubuntu Anda:

### 1. Update Server dan Install Dependensi Dasar
Pastikan server Anda up-to-date dan memiliki Python terinstal. Jalankan perintah ini di terminal server Anda:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv -y
```

### 2. Clone Repositori (Atau Upload File)
Jika Anda menggunakan git, clone repositori ini ke server Anda. Jika tidak, upload semua file (`app.py`, `requirements.txt`, folder `templates`, dan folder `static`) ke dalam satu direktori di server, misalnya `/home/mumtaz/chatbot`.

```bash
# Contoh membuat folder dan masuk ke dalamnya
mkdir -p /home/mumtaz/chatbot
cd /home/mumtaz/chatbot
```

*(Pastikan semua file proyek sudah berada di folder ini).*

### 3. Buat Virtual Environment (Sangat Direkomendasikan)
Untuk menjaga agar dependensi Python tidak bentrok dengan sistem Ubuntu, gunakan virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```
*(Anda akan melihat awalan `(venv)` di terminal Anda).*

### 4. Install Dependensi Python
Install semua library yang dibutuhkan dari file `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 5. Setup API Key Gemini
Anda harus memiliki API Key dari Google Gemini (bisa didapatkan secara gratis di [Google AI Studio](https://aistudio.google.com/)).

Buat file `.env` di folder proyek Anda:

```bash
nano .env
```

Lalu isi dengan API Key Anda seperti ini:

```
GEMINI_API_KEY=masukkan_api_key_anda_disini
```

Simpan dan keluar (di Nano: tekan `Ctrl+X`, lalu `Y`, lalu `Enter`).

### 6. Jalankan Aplikasi (Untuk Testing)
Anda bisa mengetes apakah aplikasi berjalan dengan baik menggunakan server bawaan Flask:

```bash
python3 app.py
```
*Aplikasi akan berjalan di port 5000. Anda bisa mengaksesnya di browser via `http://IP_SERVER_ANDA:5000` (Pastikan port 5000 diizinkan di firewall Anda).*

### 7. Jalankan Aplikasi di Production (Gunicorn)
Server bawaan Flask tidak direkomendasikan untuk produksi. Kita akan menggunakan **Gunicorn**, yang sangat ringan dan stabil.

Saat masih di dalam virtual environment (`source venv/bin/activate`), jalankan:

```bash
gunicorn --bind 0.0.0.0:8000 app:app --workers 2 --threads 2
```
*Ini akan menjalankan aplikasi di port 8000.*

### 8. (Opsional tapi Direkomendasikan) Jalankan di Background dengan Systemd
Agar aplikasi tetap berjalan meskipun Anda menutup terminal, dan otomatis menyala saat server direstart, buat service systemd.

Buat file service:
```bash
sudo nano /etc/systemd/system/chatbot.service
```

Isi dengan (sesuaikan path `/home/mumtaz/chatbot` jika berbeda):
```ini
[Unit]
Description=Gunicorn instance to serve Retro Chatbot
After=network.target

[Service]
User=mumtaz
Group=www-data
WorkingDirectory=/home/mumtaz/chatbot
Environment="PATH=/home/mumtaz/chatbot/venv/bin"
# Muat environment variable dari .env
EnvironmentFile=/home/mumtaz/chatbot/.env
ExecStart=/home/mumtaz/chatbot/venv/bin/gunicorn --workers 2 --bind 0.0.0.0:8000 app:app

[Install]
WantedBy=multi-user.target
```

Jalankan dan aktifkan service:
```bash
sudo systemctl daemon-reload
sudo systemctl start chatbot
sudo systemctl enable chatbot
```

Sekarang website chatbot Anda bisa diakses di `http://IP_SERVER_ANDA:8000` kapan saja!

---

**Catatan RAM/Storage:**
Aplikasi ini dan environment Gunicorn biasanya hanya memakan sekitar 30-50MB RAM saja. Sangat aman untuk sisa RAM dan Storage Anda yang terbatas.
