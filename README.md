# 🚀 NoManSucode - 3D Open-World Space Exploration (Web Edition)

Selamat datang di **NoManSucode**, game eksplorasi luar angkasa 3D *open-world* berbasis *web browser* (Three.js + WebGL + Procedural Noise) sesuai spesifikasi PRD.

## ✨ Fitur Utama yang Sudah Terimplementasi
1. **Seamless Space-to-Planet Landing:** Terbang dari ruang hampa, menembus atmosfer planet secara langsung tanpa layar *loading*, dan mendarat di permukaan planet bulat 3D (`[E]`).
2. **Spherical Radial Gravity (Gravitasi 360°):** Setelah mendarat, karakter Anda berjalan mengelilingi permukaan bola planet secara utuh dengan gravitasi yang selalu menarik ke titik pusat planet.
3. **5 Planet Prosedural Unik + Sabuk Asteroid + Stasiun Angkasa:**
   - **TERRA-PRIME:** Planet tropis dengan lautan biru dan hutan Xeno-Carbon.
   - **PYROS-IV:** Planet vulkanik bersuhu ekstrem dengan lautan magma dan kaya Ferrite.
   - **CRYO-NOVA:** Planet es bercincin raksasa dengan deposit Kristal Cobalt.
   - **TOX-VORTEX:** Planet rawa spora asam dengan flora mutasi.
   - **AETHER-CORE:** Planet anomali siber bergravitasi rendah yang kaya akan monolit **Sucode Shard**.
4. **Terminal Pemrograman Drone "Sucode" (`[C]`):**
   - Tulis kode atau klik blok instruksi (`SCAN_TARGET`, `MOVE_TO_TARGET`, `FIRE_MINING_LASER`, `IF_FULL_TRANSFER_TO_PLAYER`) untuk merakit dan memprogram **Drone Otonom 3D** yang terbang dan menambang sumber daya secara otomatis untuk Anda!
5. **Multi-Tool Mining Laser, Base Building & Upgrades:**
   - Tambang batu, pohon alien, kristal, dan asteroid dengan klik kiri.
   - Bangun Kubah Markas Koloni (`[B]`) di permukaan planet mana pun.
   - Tingkatkan level Laser, Mesin Hyperdrive, dan Perisai Eksosuit (`[I]`).
6. **Procedural Web Audio Synthesizer:** Efek suara mesin pesawat, tembakan laser, radar scan, dan notifikasi dihasilkan secara matematis menggunakan *Web Audio API*.

---

## 🎮 Cara Memainkan (Sangat Mudah)
1. **Ekstrak (Unzip)** file `NoManSucode-WebGame.zip` ke folder mana pun di komputer Anda.
2. **Klik 2x file `index.html`** untuk langsung memainkannya di browser (Chrome, Edge, Brave, atau Firefox) — *pastikan komputer terhubung ke internet agar library grafis Three.js CDN termuat, atau jalankan lewat Live Server*.
3. Masukkan **Seed Alam Semesta** (atau klik tombol 🎲) lalu klik **MULAI EKSPLORASI (LAUNCH)**.

---

## 🕹️ Daftar Kontrol Permainan

### Saat di Pesawat Antariksa (Starship Mode)
- `W` / `S` : Gas Thruster Maju / Mundur
- `SHIFT` (Tahan) : Pulse Warp Boost (Kecepatan Tinggi)
- `SPACE` : Rem Ruang Hampa
- `Mouse` : Arahkan Moncong Pesawat (Pitch & Yaw)
- `A` / `D` : Miringkan Sayap (Roll Kiri / Kanan)
- `Klik Kiri` : Tembak Meriam Foton (Bisa menambang Asteroid & Permukaan)
- `E` : **Mendarat di Permukaan Planet** (Saat ketinggian < 65m dari permukaan)

### Saat Jalan Kaki di Planet (Exosuit Foot Mode)
- `W` `A` `S` `D` : Berjalan mengelilingi permukaan bola planet (360° Gravitasi Radial)
- `SPACE` (Tahan) : Terbang menggunakan Jetpack
- `SHIFT` (Tahan) : Lari Cepat (Sprint)
- `Klik Kiri` : Tembak Laser Penambang Multi-Tool (Arahkan ke Batu, Pohon, atau Kristal)
- `E` : Masuk kembali ke Pesawat (Saat dekat pesawat)
- `X` : Panggil Pesawat mendarat di dekat posisi Anda

### Pintasan Sistem & Antarmuka
- `C` : Buka **Terminal Pemrograman Drone Sucode IDE**
- `I` : Buka **Menu Upgrade Teknologi & Auto-Pilot Planet**
- `Q` : Pindai Radar Sumber Daya Planet (`Scan`)
- `B` : Bangun Kubah Markas Koloni di Posisi Saat Ini
- `V` : Ganti Sudut Pandang Kamera (Third-Person / First-Person)
- `ESC` : Bebaskan Kursor Mouse
