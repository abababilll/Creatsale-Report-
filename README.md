# Creatsale - Sales Dashboard

Dashboard penjualan modern dengan sistem login, dark/light mode, dan grafik interaktif.

![Creatsale](https://img.shields.io/badge/Node.js-Ready-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Fitur

- Login & Register (password di-hash dengan scrypt)
- Nama user muncul di dashboard setelah login
- Mode Gelap / Terang
- Sidebar navigasi yang bisa diklik (scroll ke section)
- Grafik interaktif (Chart.js)
- Responsive (HP & Desktop)
- Database sederhana (JSON file)

## Cara Menjalankan

### 1. Install Node.js
Pastikan Node.js sudah terinstall di perangkat kamu.

### 2. Jalankan Server
```bash
node server.js
```

### 3. Buka Browser
```
http://localhost:3000
```

## Akun Demo

| Username | Password  |
|----------|-----------|
| admin    | admin123  |

Kamu juga bisa daftar akun baru lewat halaman Register.

## Struktur Folder

```
creatsale-app/
├── server.js          # Backend (login, session, database)
├── package.json
├── .gitignore
├── README.md
├── data/              # Database (otomatis dibuat saat pertama kali jalan)
│   └── users.json
└── public/
    ├── index.html     # Halaman Login & Register
    └── dashboard.html # Dashboard utama
```

## Teknologi

- **Backend:** Node.js (pure, tanpa framework)
- **Database:** JSON file (seperti tabel SQL)
- **Password:** crypto.scrypt (aman)
- **Frontend:** HTML, CSS, JavaScript
- **Chart:** Chart.js
- **Font:** Inter (Google Fonts)

## Menjalankan di HP (Android)

1. Install **Termux**
2. Install Node.js:
   ```bash
   pkg update && pkg install nodejs
   ```
3. Masuk ke folder project lalu jalankan:
   ```bash
   node server.js
   ```
4. Buka browser → `http://localhost:3000`

## Catatan Keamanan

- File `data/users.json` berisi hash password → **jangan di-upload** ke GitHub publik (sudah di-ignore lewat `.gitignore`)
- Ganti password default `admin123` setelah pertama kali login
- Session otomatis expire setelah 24 jam

## License

MIT
