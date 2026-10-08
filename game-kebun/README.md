# Dokumentasi Arsitektur Engine Game Isometrik 2.5D (Township Edition)

Folder ini (`game-kebun/`) berisi engine mandiri simulator pertanian dan peternakan dengan visual **Isometrik 2.5D Realistis** ala **Township** dan **Hay Day**.

---

## 1. Anatomi & Kinematika Sapi Realistis (*Realistic Cow Kinematics*)

Pada versi terbaru ini, sapi tidak lagi menggunakan lingkaran SVG sederhana, melainkan dirender menggunakan **anatomi berkaki empat (*quadruped kinematics*)**:

1. **4 Kaki Mandiri (*Walk Cycle Phase*):**
   - Kaki depan kiri & kaki belakang kanan bergerak sinkron, disusul kaki sebaliknya (`Math.sin(walkPhase)`).
   - Kuku sapi hitam bertumpu di atas bayangan jatuh elips isometrik.
2. **Torso & Belang Alami (*Friesian Holstein Pattern*):**
   - Dilengkapi gradasi pencahayaan tubuh 3D untuk ilusi volume.
   - Belang hitam asimetris khas sapi perah.
3. **Kepala Dinamis & Animasi Mengunyah (*Chewing & Grazing Motion*):**
   - Moncong pink bertekstur lubang hidung.
   - Kepala menunduk saat mengunyah rumput (`GRAZE` state) dan tegak saat melangkah (`WALK` state).
4. **Lonceng Sapi Akustik (*Pendulum Cowbell*):**
   - Lonceng emas berayun sesuai percepatan langkah kaki sapi.
5. **Ambing Susu Berdenyut (*Pulsing Udder*):**
   - Ambing susu membesar dan berdenyut ketika produksi susu mencapai 100% (`🥛 PERAH!`).
6. **Ekor Mengibas Lalat (*Tail Swish*):**
   - Ekor bersendi kurva kuadratik yang mengibas otomatis.

---

## 2. Bangunan & Lingkungan Isometrik 2.5D

1. **Kincir Angin Berputar (*Windmill Sails*):**
   - Menara batu kerucut dengan baling-baling 4 bilah kayu yang berputar kontinu dengan kecepatan angular $\omega$.
2. **Lumbung Merah Amerika (*Red Barn*):**
   - Lengkap dengan atap *gambrel*, pintu silang putih, dan bayangan jatuh miring.
3. **Tanaman Jagung Melambai (*Wind Sway Effect*):**
   - Tanaman bergelombang tertiup angin menggunakan offset sinusoida posisi grid:
     $$\text{sway} = \sin(\text{time} \times 3 + \text{gx}) \times 4$$
4. **Partikel Serbuk Sari Mengambang (*Atmospheric Dust Motes*):**
   - Titik-titik cahaya matahari yang mengambang lembut di udara menciptakan nuansa hangat pedesaan.

---

## 3. Fitur Interaktif Baru (Township & Hay Day Edition)

1. **Gestur Geser Sekali Usap (*Swipe-to-Feed & Swipe-to-Harvest*):**
   - Mengetuk tanaman atau ternak memunculkan alat mengambang (Sabit 🪓, Pakan Sapi 🌾, Pakan Ayam 🥣, Ember Susu 🥛, Keranjang Telur 🥚).
   - Pemain cukup menyeret/mengusap mouse/layar melintasi deretan ternak atau tanaman untuk mengeksekusi aksi berantai secara cepat dan memuaskan.
2. **Kandang Ayam & Ayam Petelur (*Chicken Coop & Laying Hens*):**
   - Kandang kayu beratap genteng merah dan penunjuk arah angin ayam emas.
   - 3 ekor ayam petelur yang mematuk tanah, mengepakkan sayap, dan menghasilkan telur segar jika diberi pakan butir.
3. **Kandang Kambing Etawa (*Dairy Goat Pen*):**
   - Kandang kambing khusus dengan kambing berbulu cokelat-putih, telinga panjang menjuntai bergoyang, tanduk melengkung, dan lompatan kecil (*hopping kinematics*).
   - Menghasilkan susu kambing segar dan poin XP.
4. **Sektor Agroforestry & Konservasi DAS (*Carbon Sequestration*):**
   - Penanaman pohon konservasi: **Pohon Sengon** (tumbuh cepat, batang ramping putih, tajuk daun hijau muda) dan **Kayu Ulin Kalimantan** (kayu besi, tajuk rimbun hijau tua).
   - Menghasilkan panen kayu lestari dan menambah akumulasi serapan karbon (**$\text{kg CO}_2$**) yang dipantau langsung pada badge HUD atas!
5. **Pabrik Pakan Ternak (*Feed Mill*):**
   - Dilengkapi roda gigi penggiling berputar dan cerobong asap industri.
   - Resep produksi: Menggiling jagung & rumput gajah menjadi Pakan Sapi Jumbo dan Pakan Butir Ayam.
6. **Papan Pesanan Dapur & Logistik Camp (*Township Order Board*):**
   - Menerima pesanan ransum dari mess karyawan dan patroli karhutla POKEMONKEY.
   - Truk pickup logistik berjalan menyusuri jalan isometrik mengantarkan pesanan dan kembali membawa Koin & XP.
7. **Posko Misi Lapangan POKEMONKEY (*Real Operations Missions Hub*):**
   - Menghubungkan aktivitas harian nyata tim:
     - 📑 *Baca Memo Dinas & SOP Lapangan* $\rightarrow$ Bonus +15 Pakan Sapi & Ayam.
     - 🔥 *Monitoring Peta Titik Api Karhutla* $\rightarrow$ Bonus +120 XP & Kesuburan Pohon DAS.
     - 🛠️ *Tuntaskan Tiket Tindakan Korektif PICA* $\rightarrow$ Bonus +200 XP & +150 Koin.
8. **Siklus Pencahayaan Suasana (*Time-of-Day Atmosphere Cycles*):**
   - Tombol toggle waktu:
     - ☀️ **Siang Cerah (*Bright Day*):** Cahaya matahari jernih, serbuk sari keemasan mengambang.
     - 🌅 **Senja Keemasan (*Golden Hour Sunset*):** Cahaya jingga hangat amber dramatis.
     - 🌙 **Malam Berbintang (*Starry Night*):** Langit gelap bertabur bintang berkelap-kelip dengan lentera lumbung bercahaya hangat (*warm glow*).
9. **Kolam Air Dinamis (*Water Pond with Animated Ripples*):**
   - Tepian batu kali dengan air beriak dinamis serta tanaman teratai berbunga lotus.

---

## 4. Sistem Kontrol & HUD Bawah (*Action Mode*)

Pemain dapat memilih mode aksi di bilah bawah:
- ✋ **Jelajah & Elus:** Menggeser kamera atau mengelus hewan untuk efek cinta ❤️.
- 🌾 **Pakan Sapi:** Memberi makan sapi (-1 Pakan Sapi).
- 🥣 **Pakan Ayam:** Memberi makan ayam (-1 Pakan Ayam).
- 🪓 **Sabit Panen:** Memotong jagung, rumput gajah, atau merawat pohon konservasi.
- 🏭 **Pabrik Pakan:** Membuka menu pengolahan pakan ternak.
- 📋 **Papan Pesanan:** Membuka daftar pesanan logistik camp.
- 🎯 **Misi Lapangan:** Membuka posko integrasi memo, karhutla, dan PICA.
- ☀️/🌅/🌙 **Cuaca/Waktu:** Mengganti pencahayaan Siang, Senja, dan Malam.
- 🐮 **Beli Sapi Baru:** Menukar 500 XP untuk sapi baru (Holstein / Limousin).
- 🐔 **Beli Ayam Baru:** Menukar 250 XP untuk ayam petelur baru.
- 🐐 **Beli Kambing Baru:** Menukar 350 XP untuk kambing etawa baru.

---

## 5. Cara Menjalankan

Buka dan klik ganda salah satu file berikut di browser Chrome / Edge:
- [`D:\pokemonkey (2)\game-kebun\index.html`](file:///D:/pokemonkey%20(2)/game-kebun/index.html)
- [`D:\pokemonkey (2)\kebunku-demo.html`](file:///D:/pokemonkey%20(2)/kebunku-demo.html)
- [`D:\pokemonkey (2)\public\kebunku-demo.html`](file:///D:/pokemonkey%20(2)/public/kebunku-demo.html)


