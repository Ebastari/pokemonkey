/**
 * Template & Utilitas YOLO 30-Day Mastery Tracker untuk Memo POKEMONKEY.
 * Menyediakan data silabus lengkap 30 hari, penghitungan kumulatif otomatis,
 * dan sinkronisasi real-time antara ceklis tabel dengan grafik.
 */

export interface ItemYolo {
  hari: string;
  fase: string;
  topik: string;
  selesai: boolean;
}

export const SILABUS_YOLO_30_HARI: ItemYolo[] = [
  // Minggu 1: Fondasi & Teori
  { hari: 'H-01', fase: 'Minggu 1: Fondasi & Teori', topik: 'Intro Object Detection (Class vs Detect vs Seg)', selesai: true },
  { hari: 'H-02', fase: 'Minggu 1: Fondasi & Teori', topik: 'Evaluasi Metrik: IoU, Conf Matrix, P, R', selesai: true },
  { hari: 'H-03', fase: 'Minggu 1: Fondasi & Teori', topik: 'Evaluasi Metrik: mAP@0.5 & mAP@0.5:0.95', selesai: true },
  { hari: 'H-04', fase: 'Minggu 1: Fondasi & Teori', topik: 'Arsitektur Single-Stage vs Two-Stage (R-CNN)', selesai: false },
  { hari: 'H-05', fase: 'Minggu 1: Fondasi & Teori', topik: 'Arsitektur YOLOv1: Grid System & Bounding Box', selesai: false },
  { hari: 'H-06', fase: 'Minggu 1: Fondasi & Teori', topik: 'Environment Setup: PyTorch, CUDA, OpenCV', selesai: false },
  { hari: 'H-07', fase: 'Minggu 1: Fondasi & Teori', topik: 'OpenCV Basics: Load Image & Draw BBox Manual', selesai: false },

  // Minggu 2: Pretrained & Ultralytics
  { hari: 'H-08', fase: 'Minggu 2: Pretrained & Ultralytics', topik: 'Evolusi YOLOv2-v4: Anchor Box, FPN, PANet', selesai: false },
  { hari: 'H-09', fase: 'Minggu 2: Pretrained & Ultralytics', topik: 'YOLOv8 & Era Modern: Anchor-Free Design', selesai: false },
  { hari: 'H-10', fase: 'Minggu 2: Pretrained & Ultralytics', topik: 'Setup Library Ultralytics & CLI Inference', selesai: false },
  { hari: 'H-11', fase: 'Minggu 2: Pretrained & Ultralytics', topik: 'Inferensi Python: Gambar & Video File', selesai: false },
  { hari: 'H-12', fase: 'Minggu 2: Pretrained & Ultralytics', topik: 'Real-Time Webcam Detection dengan OpenCV', selesai: false },
  { hari: 'H-13', fase: 'Minggu 2: Pretrained & Ultralytics', topik: 'Benchmark Model Size (nano, small, medium)', selesai: false },
  { hari: 'H-14', fase: 'Minggu 2: Pretrained & Ultralytics', topik: 'Review: Analisis Output Bounding Box & Class', selesai: false },

  // Minggu 3: Dataset & Training
  { hari: 'H-15', fase: 'Minggu 3: Dataset & Training', topik: 'Format Dataset YOLO & Struktur data.yaml', selesai: false },
  { hari: 'H-16', fase: 'Minggu 3: Dataset & Training', topik: 'Data Collection: Kumpul 100-200 Gambar', selesai: false },
  { hari: 'H-17', fase: 'Minggu 3: Dataset & Training', topik: 'Anotasi Gambar: BBox Tool (Roboflow/LabelImg)', selesai: false },
  { hari: 'H-18', fase: 'Minggu 3: Dataset & Training', topik: 'Data Augmentation & Train-Val-Test Split', selesai: false },
  { hari: 'H-19', fase: 'Minggu 3: Dataset & Training', topik: 'Fine-Tuning: Run model.train() 30-50 Epoch', selesai: false },
  { hari: 'H-20', fase: 'Minggu 3: Dataset & Training', topik: 'Analisis Training Loss (box, cls, dfl loss)', selesai: false },
  { hari: 'H-21', fase: 'Minggu 3: Dataset & Training', topik: 'Hyperparameter Tuning: Batch & Learning Rate', selesai: false },

  // Minggu 4: Deploy & Proyek
  { hari: 'H-22', fase: 'Minggu 4: Deploy & Proyek', topik: 'Eksplorasi Instance Segmentation (YOLO-seg)', selesai: false },
  { hari: 'H-23', fase: 'Minggu 4: Deploy & Proyek', topik: 'Export Model: Konversi .pt ke ONNX', selesai: false },
  { hari: 'H-24', fase: 'Minggu 4: Deploy & Proyek', topik: 'Optimasi Edge: TensorRT / OpenVINO', selesai: false },
  { hari: 'H-25', fase: 'Minggu 4: Deploy & Proyek', topik: 'Multi-Object Tracking (ByteTrack/BoT-SORT)', selesai: false },
  { hari: 'H-26', fase: 'Minggu 4: Deploy & Proyek', topik: 'Final Project: Arsitektur & Logika Sistem', selesai: false },
  { hari: 'H-27', fase: 'Minggu 4: Deploy & Proyek', topik: 'Final Project: Implementasi Line Crossing Count', selesai: false },
  { hari: 'H-28', fase: 'Minggu 4: Deploy & Proyek', topik: 'Final Project: UI Dashboard Streamlit/Gradio', selesai: false },
  { hari: 'H-29', fase: 'Minggu 4: Deploy & Proyek', topik: 'Benchmarking FPS, Latency & Error Analysis', selesai: false },
  { hari: 'H-30', fase: 'Minggu 4: Deploy & Proyek', topik: 'Dokumentasi GitHub, README & Video Demo', selesai: false },
];

/** Susun baris matriks tabel awal YOLO 30-Day Tracker */
export function susunMatriksYolo(): string[][] {
  const kepala = ['Hari', 'Fase', 'Topik / Materi', 'Status', 'Kumulatif'];
  let kumulatif = 0;

  const barisData = SILABUS_YOLO_30_HARI.map((item) => {
    if (item.selesai) kumulatif += 1;
    return [
      item.hari,
      item.fase,
      item.topik,
      item.selesai ? '✓ Selesai' : 'Belum',
      String(kumulatif),
    ];
  });

  return [kepala, ...barisData];
}

/** Hitung ringkasan progres dari tabel */
export function hitungProgresTabel(baris: string[][]): {
  total: number;
  selesai: number;
  sisa: number;
  persen: number;
  idxStatus: number;
  idxKumulatif: number;
} | null {
  if (baris.length <= 1) return null;
  const kepala = baris[0];

  const idxStatus = kepala.findIndex((h) => /status|ceklis|check/i.test(h));
  const idxKumulatif = kepala.findIndex((h) => /kumulatif|total/i.test(h));

  if (idxStatus === -1) return null;

  const total = baris.length - 1;
  let selesai = 0;

  for (let i = 1; i < baris.length; i++) {
    const s = (baris[i][idxStatus] || '').trim().toLowerCase();
    if (
      s.includes('selesai') ||
      s.includes('✓') ||
      s.includes('✔') ||
      s.includes('[x]') ||
      s.includes('☑') ||
      s === '1' ||
      s.includes('done')
    ) {
      selesai++;
    }
  }

  const sisa = Math.max(0, total - selesai);
  const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;

  return { total, selesai, sisa, persen, idxStatus, idxKumulatif };
}

/**
 * Toggle status satu baris pada tabel dan otomatis hitung ulang kolom kumulatif jika ada.
 * Mendukung status teks: '✓ Selesai' <-> 'Belum', '[x]' <-> '[ ]', dll.
 */
export function toggleStatusBarisTabel(baris: string[][], rowIdx: number): string[][] {
  if (rowIdx <= 0 || rowIdx >= baris.length) return baris;

  const info = hitungProgresTabel(baris);
  if (!info || info.idxStatus === -1) return baris;

  const idxStatus = info.idxStatus;
  const idxKumulatif = info.idxKumulatif;

  const barisBaru = baris.map((r) => [...r]);
  const selTeks = (barisBaru[rowIdx][idxStatus] || '').trim();
  const s = selTeks.toLowerCase();

  const saatIniSelesai =
    s.includes('selesai') ||
    s.includes('✓') ||
    s.includes('✔') ||
    s.includes('[x]') ||
    s.includes('☑') ||
    s === '1' ||
    s.includes('done');

  // Balikkan status
  if (saatIniSelesai) {
    if (selTeks.includes('[x]')) barisBaru[rowIdx][idxStatus] = '[ ] Belum';
    else if (selTeks.includes('☑')) barisBaru[rowIdx][idxStatus] = '☐ Belum';
    else barisBaru[rowIdx][idxStatus] = 'Belum';
  } else {
    if (selTeks.includes('[ ]')) barisBaru[rowIdx][idxStatus] = '[x] Selesai';
    else if (selTeks.includes('☐')) barisBaru[rowIdx][idxStatus] = '☑ Selesai';
    else barisBaru[rowIdx][idxStatus] = '✓ Selesai';
  }

  // Jika ada kolom kumulatif, hitung ulang secara beruntun dari atas ke bawah
  if (idxKumulatif !== -1) {
    let kum = 0;
    for (let i = 1; i < barisBaru.length; i++) {
      const st = (barisBaru[i][idxStatus] || '').trim().toLowerCase();
      const ok =
        st.includes('selesai') ||
        st.includes('✓') ||
        st.includes('✔') ||
        st.includes('[x]') ||
        st.includes('☑') ||
        st === '1' ||
        st.includes('done');
      if (ok) kum++;
      barisBaru[i][idxKumulatif] = String(kum);
    }
  }

  return barisBaru;
}

/** Rakit blok raw !tabel lengkap untuk YOLO Tracker beserta grafik garis terhubung */
export function rakitBlokYoloTracker(): string {
  const baris = susunMatriksYolo();
  const json = JSON.stringify({
    kepala: true,
    baris,
    grafik: {
      aktif: true,
      tipe: 'garis',
      sumbuX: 0, // Hari (H-01 .. H-30)
      seriY: [4], // Kolom Kumulatif
      judul: 'Grafik Tren Kumulatif Penyelesaian (Target: 30 Hari)',
    },
  });
  return `!tabel${json}`;
}
