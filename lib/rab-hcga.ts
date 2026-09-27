/**
 * Data Model, Perhitungan, dan Ekspor Excel untuk MONEY MONKEY (RAB HCGA Site).
 * Menggunakan template resmi "Contoh RAB HCGA Site.xlsx".
 */

import { demoAktif } from './api';
import type { Workbook } from 'exceljs';
import { bukuBaru, simpanBuku } from './excel';
import type { Pengguna } from './tipe-api';

export type StatusPermohonanRab =
  | 'Draf'
  | 'Diajukan'
  | 'Verifikasi'
  | 'Disetujui'
  | 'Dicairkan'
  | 'Ditolak';

export interface ItemRab {
  id: string;
  namaBarang: string;
  qty: number | null;
  satuan: string;
  hargaSatuan: number | null;
}

export interface MingguRab {
  mingguKe: number;
  label: string;
  items: ItemRab[];
}

export interface KategoriRab {
  id: string;
  nama: string;
  sheetName: string;
  wbs: string;
  minggu: MingguRab[];
}

export interface HeaderRab {
  lokasi: string;
  bulan: string;
  tahun: number;
  nomorRab: string;
  kepada: string;
  up: string;
  disetujuiOleh: string;
  tanggal: string;
  catatan: string;
}

export interface DataRabHcga {
  header: HeaderRab;
  kategori: KategoriRab[];
}

export interface PermohonanRab {
  id: string;
  nomorRab: string;
  judul: string;
  bulan: string;
  tahun: number;
  tanggalPengajuan: string;
  pemohonId: string;
  pemohonNama: string;
  status: StatusPermohonanRab;
  catatan?: string;
  data: DataRabHcga;
  totalNominal: number;
  dibuatPada: string;
  diubahPada: string;
}

export const DATA_RAB_DEFAULT: DataRabHcga = {
  "header": {
    "lokasi": "Site EBL - RANTAU",
    "bulan": "Oktober",
    "tahun": 2026,
    "nomorRab": "001/RAB/EBL-RNR/X/2026",
    "kepada": "Finance HO",
    "up": "Operation & HCA Director",
    "disetujuiOleh": "Rahmad Pudjotomo",
    "tanggal": "2026-10-01",
    "catatan": "jika total nilai >25jt (Approval s/d Pak Rahmad)"
  },
  "kategori": [
    {
      "id": "atk",
      "nama": "Keperluan ATK",
      "sheetName": "ATK",
      "wbs": "AB3.11-06.02.10.04",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": [
            {
              "id": "atk-w1-1",
              "namaBarang": "Kertas HVS A4 70gr",
              "qty": 5,
              "satuan": "Rim",
              "hargaSatuan": 55000
            },
            {
              "id": "atk-w1-2",
              "namaBarang": "Pulpen Gel Hitam (Box)",
              "qty": 2,
              "satuan": "Box",
              "hargaSatuan": 35000
            },
            {
              "id": "atk-w1-3",
              "namaBarang": "Spidol Whiteboard Snowman",
              "qty": 10,
              "satuan": "Pcs",
              "hargaSatuan": 10000
            }
          ]
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": [
            {
              "id": "atk-w2-1",
              "namaBarang": "Map Snelhecter Folio",
              "qty": 20,
              "satuan": "Pcs",
              "hargaSatuan": 5000
            },
            {
              "id": "atk-w2-2",
              "namaBarang": "Post-it Note Warna",
              "qty": 4,
              "satuan": "Pack",
              "hargaSatuan": 12000
            }
          ]
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": []
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": []
        }
      ]
    },
    {
      "id": "bbm",
      "nama": "Keperluan BBM",
      "sheetName": "BBM",
      "wbs": "AB3.11-06.02.10.04",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": [
            {
              "id": "bbm-w1-10",
              "namaBarang": "BBM Honda CRF BG 2053 BBF",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w1-11",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 1",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w1-12",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 2",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w1-13",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 3",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": [
            {
              "id": "bbm-w2-25",
              "namaBarang": "BBM Honda CRF BG 2053 BBF",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w2-26",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 1",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w2-27",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 2",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w2-28",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 3",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": [
            {
              "id": "bbm-w3-40",
              "namaBarang": "BBM Honda CRF BG 2053 BBF",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w3-41",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 1",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w3-42",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 2",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w3-43",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 3",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": [
            {
              "id": "bbm-w4-55",
              "namaBarang": "BBM Honda CRF BG 2053 BBF",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w4-56",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 1",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w4-57",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 2",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "bbm-w4-58",
              "namaBarang": "BBM Toyota Hilux Vendor Bobby 3",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        }
      ]
    },
    {
      "id": "catering",
      "nama": "Kebutuhan Catering",
      "sheetName": "Catering",
      "wbs": "AB3.11-06.02.10.04",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": [
            {
              "id": "catering-w1-10",
              "namaBarang": "Catering Staff (7 Orang)",
              "qty": null,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "catering-w1-11",
              "namaBarang": "Catering KHL (3 Orang)",
              "qty": null,
              "satuan": "pack",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": [
            {
              "id": "catering-w2-26",
              "namaBarang": "Catering Staff (7 Orang)",
              "qty": null,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "catering-w2-27",
              "namaBarang": "Catering KHL (3 Orang)",
              "qty": null,
              "satuan": "pack",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": [
            {
              "id": "catering-w3-42",
              "namaBarang": "Catering Staff (7 Orang)",
              "qty": null,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "catering-w3-43",
              "namaBarang": "Catering KHL (3 Orang)",
              "qty": null,
              "satuan": "pack",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": [
            {
              "id": "catering-w4-57",
              "namaBarang": "Catering Staff (7 Orang)",
              "qty": null,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "catering-w4-58",
              "namaBarang": "Catering KHL (3 Orang)",
              "qty": null,
              "satuan": "pack",
              "hargaSatuan": null
            }
          ]
        }
      ]
    },
    {
      "id": "perdin",
      "nama": "Perdin & Cuti Karyawan",
      "sheetName": "Perdin & Cuti",
      "wbs": "AB3.11-06.02.10.02",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": [
            {
              "id": "perdin-w1-10",
              "namaBarang": "Lumpsum Cuti Periodik Karyawan",
              "qty": 1,
              "satuan": "orang",
              "hargaSatuan": null
            },
            {
              "id": "perdin-w1-11",
              "namaBarang": "Perjalanan Dinas Karyawan",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": [
            {
              "id": "perdin-w2-25",
              "namaBarang": "Lumpsum Cuti Periodik Karyawan",
              "qty": 1,
              "satuan": "orang",
              "hargaSatuan": null
            },
            {
              "id": "perdin-w2-26",
              "namaBarang": "Perjalanan Dinas Karyawan",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": [
            {
              "id": "perdin-w3-40",
              "namaBarang": "Biaya perjalanan dinas & Cuti",
              "qty": 1,
              "satuan": "orang",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": [
            {
              "id": "perdin-w4-55",
              "namaBarang": "Biaya perjalanan dinas & Cuti",
              "qty": 1,
              "satuan": "orang",
              "hargaSatuan": null
            }
          ]
        }
      ]
    },
    {
      "id": "listrik",
      "nama": "Keperluan Listrik PLN",
      "sheetName": "Listrik PLN",
      "wbs": "AB3.11-06.02.10.04",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": [
            {
              "id": "listrik-w1-10",
              "namaBarang": "Listrik Stockpile EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w1-11",
              "namaBarang": "Listrik Mess Kupang",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w1-12",
              "namaBarang": "Listrik Gudang Handak EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w1-13",
              "namaBarang": "Listrik Office 42",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w1-14",
              "namaBarang": "Listrik Kantor & Mess EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": [
            {
              "id": "listrik-w2-20",
              "namaBarang": "Listrik Stockpile EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w2-21",
              "namaBarang": "Listrik Mess Kupang",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w2-22",
              "namaBarang": "Listrik Gudang Handak EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w2-23",
              "namaBarang": "Listrik Office 42",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w2-24",
              "namaBarang": "Listrik Kantor & Mess EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": [
            {
              "id": "listrik-w3-30",
              "namaBarang": "Listrik Stockpile EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w3-31",
              "namaBarang": "Listrik Mess Kupang",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w3-32",
              "namaBarang": "Listrik Gudang Handak EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w3-33",
              "namaBarang": "Listrik Office 42",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w3-34",
              "namaBarang": "Listrik Kantor & Mess EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": [
            {
              "id": "listrik-w4-40",
              "namaBarang": "Listrik Stockpile EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w4-41",
              "namaBarang": "Listrik Mess Kupang",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w4-42",
              "namaBarang": "Listrik Gudang Handak EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w4-43",
              "namaBarang": "Listrik Office 42",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "listrik-w4-44",
              "namaBarang": "Listrik Kantor & Mess EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        }
      ]
    },
    {
      "id": "air",
      "nama": "Keperluan Air PDAM",
      "sheetName": "Air PDAM",
      "wbs": "AB3.11-06.02.10.04",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": [
            {
              "id": "air-w1-10",
              "namaBarang": "Air PDAM Stockpile EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w1-11",
              "namaBarang": "Air PDAM Mess Kupang",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w1-12",
              "namaBarang": "Air PDAM Gudang Handak EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w1-13",
              "namaBarang": "Air PDAM Office 42",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w1-14",
              "namaBarang": "Air PDAM Kantor & Mess EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": [
            {
              "id": "air-w2-20",
              "namaBarang": "Air PDAM Stockpile EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w2-21",
              "namaBarang": "Air PDAM Mess Kupang",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w2-22",
              "namaBarang": "Air PDAM Gudang Handak EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w2-23",
              "namaBarang": "Air PDAM Office 42",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w2-24",
              "namaBarang": "Air PDAM Kantor & Mess EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": [
            {
              "id": "air-w3-30",
              "namaBarang": "Air PDAM Stockpile EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w3-31",
              "namaBarang": "Air PDAM Mess Kupang",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w3-32",
              "namaBarang": "Air PDAM Gudang Handak EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w3-33",
              "namaBarang": "Air PDAM Office 42",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w3-34",
              "namaBarang": "Air PDAM Kantor & Mess EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": [
            {
              "id": "air-w4-40",
              "namaBarang": "Air PDAM Stockpile EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w4-41",
              "namaBarang": "Air PDAM Mess Kupang",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w4-42",
              "namaBarang": "Air PDAM Gudang Handak EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w4-43",
              "namaBarang": "Air PDAM Office 42",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "air-w4-44",
              "namaBarang": "Air PDAM Kantor & Mess EBL",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        }
      ]
    },
    {
      "id": "telp",
      "nama": "Keperluan Telp & Internet",
      "sheetName": "Telp & Internet",
      "wbs": "AB3.11-06.02.10.04",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": [
            {
              "id": "telp-w1-10",
              "namaBarang": "Pembayaran Indihome PT EBL ( Mess Kantor)",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "telp-w1-11",
              "namaBarang": "Pembayaran Indihome PT EBL ( Mess Tahura)",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            },
            {
              "id": "telp-w1-12",
              "namaBarang": "Pembayaran Telkom Speedy PT EBL (Kantor)",
              "qty": null,
              "satuan": "",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": []
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": []
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": []
        }
      ]
    },
    {
      "id": "pantry",
      "nama": "Keperluan Pantry",
      "sheetName": "Pantry",
      "wbs": "AB3.11-06.02.10.04",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": [
            {
              "id": "pantry-w1-10",
              "namaBarang": "Air Galon",
              "qty": null,
              "satuan": "galon",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-11",
              "namaBarang": "Gas LPG",
              "qty": null,
              "satuan": "tabung",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-12",
              "namaBarang": "Pembersih Kamar mandi",
              "qty": 1,
              "satuan": "btl",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-13",
              "namaBarang": "Tissue",
              "qty": 1,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-14",
              "namaBarang": "Pengharum Ruangan",
              "qty": 1,
              "satuan": "pcs",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-15",
              "namaBarang": "Trashbag",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-16",
              "namaBarang": "Pembersih Lantai",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-17",
              "namaBarang": "Kamper Kamar mandi",
              "qty": 2,
              "satuan": "bks",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-18",
              "namaBarang": "Semprotan nyamuk",
              "qty": 2,
              "satuan": "btl",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-19",
              "namaBarang": "Obat nyamuk bakar",
              "qty": 1,
              "satuan": "Bks",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w1-20",
              "namaBarang": "Sabun cuci piring",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": [
            {
              "id": "pantry-w2-26",
              "namaBarang": "Air Galon",
              "qty": null,
              "satuan": "galon",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-27",
              "namaBarang": "Gas LPG",
              "qty": null,
              "satuan": "tabung",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-28",
              "namaBarang": "Pembersih Kamar mandi",
              "qty": 1,
              "satuan": "btl",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-29",
              "namaBarang": "Tissue",
              "qty": 1,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-30",
              "namaBarang": "Pengharum Ruangan",
              "qty": 1,
              "satuan": "pcs",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-31",
              "namaBarang": "Trashbag",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-32",
              "namaBarang": "Pembersih Lantai",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-33",
              "namaBarang": "Kamper Kamar mandi",
              "qty": 2,
              "satuan": "bks",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-34",
              "namaBarang": "Semprotan nyamuk",
              "qty": 2,
              "satuan": "btl",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-35",
              "namaBarang": "Obat nyamuk bakar",
              "qty": 1,
              "satuan": "Bks",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w2-36",
              "namaBarang": "Sabun cuci piring",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": [
            {
              "id": "pantry-w3-42",
              "namaBarang": "Air Galon",
              "qty": null,
              "satuan": "Galon",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-43",
              "namaBarang": "Gas LPG",
              "qty": null,
              "satuan": "tabung",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-44",
              "namaBarang": "Pembersih Kamar mandi",
              "qty": 1,
              "satuan": "btl",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-45",
              "namaBarang": "Tissue",
              "qty": 1,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-46",
              "namaBarang": "Pengharum Ruangan",
              "qty": 1,
              "satuan": "pcs",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-47",
              "namaBarang": "Trashbag",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-48",
              "namaBarang": "Pembersih Lantai",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-49",
              "namaBarang": "Kamper Kamar mandi",
              "qty": 2,
              "satuan": "bks",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-50",
              "namaBarang": "Semprotan nyamuk",
              "qty": 2,
              "satuan": "btl",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-51",
              "namaBarang": "Obat nyamuk bakar",
              "qty": 1,
              "satuan": "Bks",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w3-52",
              "namaBarang": "Sabun cuci piring",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            }
          ]
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": [
            {
              "id": "pantry-w4-58",
              "namaBarang": "Air Galon",
              "qty": null,
              "satuan": "Galon",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-59",
              "namaBarang": "Gas LPG",
              "qty": null,
              "satuan": "tabung",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-60",
              "namaBarang": "Pembersih Kamar mandi",
              "qty": 1,
              "satuan": "btl",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-61",
              "namaBarang": "Tissue",
              "qty": 1,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-62",
              "namaBarang": "Pengharum Ruangan",
              "qty": 1,
              "satuan": "pcs",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-63",
              "namaBarang": "Trashbag",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-64",
              "namaBarang": "Pembersih Lantai",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-65",
              "namaBarang": "Kamper Kamar mandi",
              "qty": 2,
              "satuan": "bks",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-66",
              "namaBarang": "Semprotan nyamuk",
              "qty": 2,
              "satuan": "btl",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-67",
              "namaBarang": "Obat nyamuk bakar",
              "qty": 1,
              "satuan": "Bks",
              "hargaSatuan": null
            },
            {
              "id": "pantry-w4-68",
              "namaBarang": "Sabun cuci piring",
              "qty": 2,
              "satuan": "pack",
              "hargaSatuan": null
            }
          ]
        }
      ]
    },
    {
      "id": "khl",
      "nama": "Keperluan Upah KHL",
      "sheetName": "KHL",
      "wbs": "AB3.11-06.02.10.04",
      "minggu": [
        {
          "mingguKe": 1,
          "label": "Minggu I",
          "items": []
        },
        {
          "mingguKe": 2,
          "label": "Minggu II",
          "items": []
        },
        {
          "mingguKe": 3,
          "label": "Minggu III",
          "items": []
        },
        {
          "mingguKe": 4,
          "label": "Minggu IV",
          "items": [
            {
              "id": "khl-w4-55",
              "namaBarang": "Upah ART Bu Ijah (Mess & Kantor Sungai Lilin)",
              "qty": 1,
              "satuan": "Orang",
              "hargaSatuan": null
            },
            {
              "id": "khl-w4-56",
              "namaBarang": "Upah ART Bu Suryani (Mess Tritunggal 1)",
              "qty": 1,
              "satuan": "Orang",
              "hargaSatuan": null
            },
            {
              "id": "khl-w4-57",
              "namaBarang": "Upah KHL M. Nuh (Security Mess Sungai lilin)",
              "qty": 1,
              "satuan": "Orang",
              "hargaSatuan": null
            }
          ]
        }
      ]
    }
  ]
};

export const KUNCI_STORAGE_RAB = 'pokemonkey_data_rab_hcga_v1';

/**
 * Mode demo memakai kepala dokumen fiktif (tanpa nama site, nomor RAB, dan
 * pejabat penyetuju yang sebenarnya) serta penyimpanan terpisah.
 */
export const DATA_RAB_DEMO: DataRabHcga = {
  ...DATA_RAB_DEFAULT,
  header: {
    ...DATA_RAB_DEFAULT.header,
    lokasi: 'Kantor Contoh',
    nomorRab: 'CONTOH/RAB/X/2026',
    kepada: 'Bagian Keuangan',
    up: 'Pimpinan Unit',
    disetujuiOleh: 'Nama Penyetuju',
    catatan: 'CONTOH · angka dan nama di sini fiktif, hanya untuk mencoba aplikasi',
  },
};

const kunciRab = () => (demoAktif() ? `${KUNCI_STORAGE_RAB}_demo` : KUNCI_STORAGE_RAB);

export function muatDataRab(): DataRabHcga {
  const bawaan = demoAktif() ? DATA_RAB_DEMO : DATA_RAB_DEFAULT;
  if (typeof window === 'undefined') return bawaan;
  try {
    const raw = localStorage.getItem(kunciRab());
    if (!raw) return bawaan;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.header && Array.isArray(parsed.kategori)) {
      return parsed;
    }
  } catch {
    // fallback ke bawaan
  }
  return bawaan;
}

export function simpanDataRab(data: DataRabHcga): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(kunciRab(), JSON.stringify(data));
  } catch {
    // abaikan jika storage penuh
  }
}

export function resetDataRab(): DataRabHcga {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(kunciRab());
    } catch {}
  }
  return JSON.parse(JSON.stringify(DATA_RAB_DEFAULT));
}

export function hitungTotalItem(it: ItemRab): number {
  const q = Number(it.qty) || 0;
  const h = Number(it.hargaSatuan) || 0;
  return q * h;
}

export function hitungSubtotalMinggu(m: MingguRab): number {
  return m.items.reduce((acc, it) => acc + hitungTotalItem(it), 0);
}

export function hitungTotalKategori(k: KategoriRab): number {
  return k.minggu.reduce((acc, m) => acc + hitungSubtotalMinggu(m), 0);
}

export function hitungGrandTotal(data: DataRabHcga): {
  perMinggu: [number, number, number, number];
  grandTotal: number;
} {
  const perMinggu: [number, number, number, number] = [0, 0, 0, 0];
  let grandTotal = 0;

  data.kategori.forEach((k) => {
    k.minggu.forEach((m, idx) => {
      if (idx >= 0 && idx < 4) {
        const sub = hitungSubtotalMinggu(m);
        perMinggu[idx] += sub;
        grandTotal += sub;
      }
    });
  });

  return { perMinggu, grandTotal };
}

export function formatRupiah(val?: number | null): string {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

/** Peta baris awal untuk tiap minggu di sheet rincian template */
const PETA_BARIS_MINGGU: Record<string, { start: number; end: number; tot: number }[]> = {
  // ATK, BBM, Perdin, KHL: W1(10-19, tot 20), W2(25-34, tot 35), W3(40-49, tot 50), W4(55-64, tot 65)
  standar: [
    { start: 10, end: 19, tot: 20 },
    { start: 25, end: 34, tot: 35 },
    { start: 40, end: 49, tot: 50 },
    { start: 55, end: 64, tot: 65 },
  ],
  // Pantry: W1(10-20, tot 21), W2(26-36, tot 37), W3(42-52, tot 53), W4(58-68, tot 69)
  pantry: [
    { start: 10, end: 20, tot: 21 },
    { start: 26, end: 36, tot: 37 },
    { start: 42, end: 52, tot: 53 },
    { start: 58, end: 68, tot: 69 },
  ],
  // Catering: W1(10-19, tot 20), W2(26-35, tot 36), W3(42-51, tot 52), W4(57-66, tot 67)
  catering: [
    { start: 10, end: 19, tot: 20 },
    { start: 26, end: 35, tot: 36 },
    { start: 42, end: 51, tot: 52 },
    { start: 57, end: 66, tot: 67 },
  ],
  // Listrik, Air, Telp: W1(10-14, tot 15/16/17), W2(20-24, tot 25/26/27), W3(30-34, tot 35/36/37), W4(40-44, tot 45/46/47)
  utilitas: [
    { start: 10, end: 14, tot: 15 },
    { start: 20, end: 24, tot: 25 },
    { start: 30, end: 34, tot: 35 },
    { start: 40, end: 44, tot: 45 },
  ],
};

function ambilPetaBaris(sheetName: string) {
  const norm = sheetName.toLowerCase();
  if (norm.includes('pantry')) return PETA_BARIS_MINGGU.pantry;
  if (norm.includes('catering')) return PETA_BARIS_MINGGU.catering;
  if (norm.includes('listrik') || norm.includes('air') || norm.includes('telp')) return PETA_BARIS_MINGGU.utilitas;
  return PETA_BARIS_MINGGU.standar;
}

/** Peta baris kategori di sheet 'HCGA Okt 2026' */
const BARIS_KATEGORI_REKAP: Record<string, number> = {
  atk: 19,
  bbm: 20,
  catering: 21,
  perdin: 22,
  listrik: 23,
  air: 24,
  telp: 25,
  pantry: 26,
  khl: 27,
};

/**
 * Mengisi template "Contoh RAB HCGA Site.xlsx" dengan data aktual formulir
 * dan menyimpannya sebagai berkas Excel yang siap diunduh.
 */
export async function eksporRabKeExcel(data: DataRabHcga): Promise<'dibagikan' | 'diunduh'> {
  let wb: Workbook;
  try {
    const res = await fetch('/template-rab-hcga.xlsx');
    if (!res.ok) throw new Error('Berkas template tidak ditemukan di server.');
    const buf = await res.arrayBuffer();
    const mod = await import('exceljs');
    const ExcelJS = ((mod as unknown as { default?: typeof mod }).default ?? mod);
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
  } catch (err) {
    console.warn('Gagal memuat template dari /template-rab-hcga.xlsx, membuat buku kerja baru:', err);
    wb = await bukuBaru();
  }

  // 1. Perbarui Sheet Rekap Utama
  const rekapSheet = wb.getWorksheet('HCGA Okt 2026') || wb.worksheets[1] || wb.worksheets[0];
  if (rekapSheet) {
    // Header metadata
    rekapSheet.getCell('D7').value = `: ${data.header.lokasi}`;
    rekapSheet.getCell('F8').value = `Bulan : ${data.header.bulan}                                          Tahun : ${data.header.tahun}`;
    rekapSheet.getCell('E12').value = data.header.nomorRab;
    rekapSheet.getCell('E14').value = data.header.tanggal;
    rekapSheet.getCell('G14').value = data.header.disetujuiOleh;

    // Nilai per kategori
    data.kategori.forEach((k) => {
      const baris = BARIS_KATEGORI_REKAP[k.id];
      if (baris) {
        k.minggu.forEach((m, idx) => {
          const colHuruf = ['F', 'G', 'H', 'I'][idx];
          if (colHuruf) {
            const sub = hitungSubtotalMinggu(m);
            const cell = rekapSheet.getCell(`${colHuruf}${baris}`);
            if (cell.formula) {
              cell.value = { formula: cell.formula, result: sub };
            } else {
              cell.value = sub;
            }
          }
        });
        const totalKat = hitungTotalKategori(k);
        const cellTot = rekapSheet.getCell(`J${baris}`);
        if (cellTot.formula) {
          cellTot.value = { formula: cellTot.formula, result: totalKat };
        } else {
          cellTot.value = totalKat;
        }
      }
    });

    // Nilai Grand Total
    const totals = hitungGrandTotal(data);
    totals.perMinggu.forEach((val, idx) => {
      const colHuruf = ['F', 'G', 'H', 'I'][idx];
      const c33 = rekapSheet.getCell(`${colHuruf}33`);
      if (c33.formula) c33.value = { formula: c33.formula, result: val };
      else c33.value = val;
    });
    const cTot = rekapSheet.getCell('J33');
    if (cTot.formula) cTot.value = { formula: cTot.formula, result: totals.grandTotal };
    else cTot.value = totals.grandTotal;
  }

  // 2. Perbarui Sheet Rincian Kategori
  data.kategori.forEach((k) => {
    const ws = wb.getWorksheet(k.sheetName);
    if (!ws) return;

    const peta = ambilPetaBaris(k.sheetName);

    k.minggu.forEach((m, mIdx) => {
      const infoMinggu = peta[mIdx];
      if (!infoMinggu) return;

      const subtotal = hitungSubtotalMinggu(m);

      m.items.forEach((it, itIdx) => {
        const r = infoMinggu.start + itIdx;
        if (r <= infoMinggu.end) {
          ws.getCell(`D${r}`).value = it.namaBarang;
          ws.getCell(`E${r}`).value = it.qty;
          ws.getCell(`F${r}`).value = it.satuan;
          ws.getCell(`G${r}`).value = it.hargaSatuan;

          const totalItem = hitungTotalItem(it);
          const cellH = ws.getCell(`H${r}`);
          if (cellH.formula) {
            cellH.value = { formula: cellH.formula, result: totalItem };
          } else {
            cellH.value = totalItem > 0 ? totalItem : null;
          }
        }
      });

      // Update cell subtotal
      const cellSub = ws.getCell(`H${infoMinggu.tot}`);
      if (cellSub.formula) {
        cellSub.value = { formula: cellSub.formula, result: subtotal };
      } else {
        cellSub.value = subtotal;
      }
    });
  });

  const namaBerkas = `RAB-HCGA-${data.header.bulan.replace(/\s+/g, '_')}-${data.header.tahun}.xlsx`;
  return await simpanBuku(wb, namaBerkas, 'RAB HCGA Site');
}

export const KUNCI_STORAGE_PERMOHONAN_RAB = 'pokemonkey_permohonan_rab_list_v1';

export const BULAN_ROMAWI: Record<string, string> = {
  Januari: 'I',
  Februari: 'II',
  Maret: 'III',
  April: 'IV',
  Mei: 'V',
  Juni: 'VI',
  Juli: 'VII',
  Agustus: 'VIII',
  September: 'IX',
  Oktober: 'X',
  November: 'XI',
  Desember: 'XII',
};

export const DAFTAR_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function buatPermohonanAwal(pengguna?: Pengguna | null): PermohonanRab {
  const data = JSON.parse(JSON.stringify(DATA_RAB_DEFAULT)) as DataRabHcga;
  const tot = hitungGrandTotal(data).grandTotal;
  return {
    id: 'rab-okt-2026',
    nomorRab: data.header.nomorRab,
    judul: `RAB HCGA Site - ${data.header.bulan} ${data.header.tahun}`,
    bulan: data.header.bulan,
    tahun: data.header.tahun,
    tanggalPengajuan: data.header.tanggal || '2026-10-01',
    pemohonId: pengguna?.id || 'admin',
    pemohonNama: pengguna?.nama || 'Admin HCGA',
    status: 'Disetujui',
    catatan: data.header.catatan,
    data,
    totalNominal: tot,
    dibuatPada: '2026-10-01T08:00:00.000Z',
    diubahPada: '2026-10-01T08:00:00.000Z',
  };
}

export function buatPermohonanBaru(params: {
  judul?: string;
  bulan: string;
  tahun: number;
  nomorRab?: string;
  lokasi?: string;
  salinDataContoh?: boolean;
  pengguna?: Pengguna | null;
}): PermohonanRab {
  const romawi = BULAN_ROMAWI[params.bulan] || 'I';
  const nomorRab = params.nomorRab?.trim() || `RAB/EBL-RNR/${romawi}/${params.tahun}`;
  const nowStr = new Date().toISOString();
  const tglHariIni = nowStr.slice(0, 10);

  let dataBaru: DataRabHcga;
  if (params.salinDataContoh) {
    dataBaru = JSON.parse(JSON.stringify(DATA_RAB_DEFAULT)) as DataRabHcga;
  } else {
    dataBaru = JSON.parse(JSON.stringify(DATA_RAB_DEFAULT)) as DataRabHcga;
    dataBaru.kategori.forEach((kat) => {
      kat.minggu.forEach((m) => {
        m.items = [];
      });
    });
  }

  dataBaru.header.bulan = params.bulan;
  dataBaru.header.tahun = params.tahun;
  dataBaru.header.nomorRab = nomorRab;
  dataBaru.header.tanggal = tglHariIni;
  if (params.lokasi?.trim()) {
    dataBaru.header.lokasi = params.lokasi.trim();
  }

  const tot = hitungGrandTotal(dataBaru).grandTotal;
  const idBaru = `rab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return {
    id: idBaru,
    nomorRab,
    judul: params.judul?.trim() || `RAB HCGA Site - ${params.bulan} ${params.tahun}`,
    bulan: params.bulan,
    tahun: params.tahun,
    tanggalPengajuan: tglHariIni,
    pemohonId: params.pengguna?.id || 'user',
    pemohonNama: params.pengguna?.nama || 'Staff HCGA',
    status: 'Diajukan',
    catatan: dataBaru.header.catatan,
    data: dataBaru,
    totalNominal: tot,
    dibuatPada: nowStr,
    diubahPada: nowStr,
  };
}

export function muatDaftarPermohonan(pengguna?: Pengguna | null): PermohonanRab[] {
  if (typeof window === 'undefined') return [buatPermohonanAwal(pengguna)];
  try {
    const raw = localStorage.getItem(KUNCI_STORAGE_PERMOHONAN_RAB);
    if (!raw) {
      const awal = [buatPermohonanAwal(pengguna)];
      localStorage.setItem(KUNCI_STORAGE_PERMOHONAN_RAB, JSON.stringify(awal));
      return awal;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    const awal = [buatPermohonanAwal(pengguna)];
    localStorage.setItem(KUNCI_STORAGE_PERMOHONAN_RAB, JSON.stringify(awal));
    return awal;
  } catch (err) {
    console.error('Gagal memuat daftar permohonan RAB:', err);
    return [buatPermohonanAwal(pengguna)];
  }
}

export function simpanDaftarPermohonan(daftar: PermohonanRab[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KUNCI_STORAGE_PERMOHONAN_RAB, JSON.stringify(daftar));
  } catch (err) {
    console.warn('Gagal menyimpan daftar permohonan RAB ke localStorage:', err);
  }
}

export function hitungMetrikTracking(daftar: PermohonanRab[]) {
  let totalNominalSemua = 0;
  let totalNominalDisetujui = 0;
  let totalNominalDiajukan = 0;
  let countDraf = 0;
  let countDiajukan = 0;
  let countVerifikasi = 0;
  let countDisetujui = 0;
  let countDicairkan = 0;
  let countDitolak = 0;

  for (const item of daftar) {
    const nom = Number(item.totalNominal) || 0;
    totalNominalSemua += nom;
    switch (item.status) {
      case 'Draf':
        countDraf++;
        break;
      case 'Diajukan':
        countDiajukan++;
        totalNominalDiajukan += nom;
        break;
      case 'Verifikasi':
        countVerifikasi++;
        totalNominalDiajukan += nom;
        break;
      case 'Disetujui':
        countDisetujui++;
        totalNominalDisetujui += nom;
        break;
      case 'Dicairkan':
        countDicairkan++;
        totalNominalDisetujui += nom;
        break;
      case 'Ditolak':
        countDitolak++;
        break;
    }
  }

  return {
    totalPengajuan: daftar.length,
    totalNominalSemua,
    totalNominalDisetujui,
    totalNominalDiajukan,
    countDraf,
    countDiajukan,
    countVerifikasi,
    countDisetujui,
    countDicairkan,
    countDitolak,
  };
}

