package id.ebl.pokemonkey;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class WidgetHelper {
    public static final String PREF_NAME = "pokemonkey_widget_data";
    public static final String KEY_DATA = "widget_json_data";

    public static void simpanData(Context context, String jsonStr) {
        if (context == null || jsonStr == null) return;
        SharedPreferences pref = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        pref.edit().putString(KEY_DATA, jsonStr).apply();
    }

    public static JSONObject ambilData(Context context) {
        if (context == null) return new JSONObject();
        SharedPreferences pref = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String raw = pref.getString(KEY_DATA, "{}");
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static PendingIntent buatPendingIntent(Context context, String tab, int reqCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("tab", tab);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, reqCode, intent, flags);
    }

    public static void perbaruiSemuaWidget(Context context) {
        if (context == null) return;
        AppWidgetManager manager = AppWidgetManager.getInstance(context);

        // 1. Dashboard Widget
        ComponentName dashComp = new ComponentName(context, DashboardWidgetProvider.class);
        int[] dashIds = manager.getAppWidgetIds(dashComp);
        if (dashIds != null && dashIds.length > 0) {
            perbaruiDashboard(context, manager, dashIds);
        }

        // 2. PICA Widget
        ComponentName kalComp = new ComponentName(context, KalenderWidgetProvider.class);
        int[] kalIds = manager.getAppWidgetIds(kalComp);
        if (kalIds != null && kalIds.length > 0) {
            perbaruiKalender(context, manager, kalIds);
        }

        ComponentName picaComp = new ComponentName(context, PicaWidgetProvider.class);
        int[] picaIds = manager.getAppWidgetIds(picaComp);
        if (picaIds != null && picaIds.length > 0) {
            perbaruiPica(context, manager, picaIds);
        }

        // 3. Jadwal Widget
        ComponentName jadwalComp = new ComponentName(context, JadwalWidgetProvider.class);
        int[] jadwalIds = manager.getAppWidgetIds(jadwalComp);
        if (jadwalIds != null && jadwalIds.length > 0) {
            perbaruiJadwal(context, manager, jadwalIds);
        }
    }

    public static void perbaruiDashboard(Context context, AppWidgetManager manager, int[] ids) {
        JSONObject data = ambilData(context);
        String waktuKini = new SimpleDateFormat("HH:mm 'WITA'", Locale.getDefault()).format(new Date());

        String cuaca = data.optString("cuaca", "Cek di aplikasi");
        String titikApi = data.optString("titikApi", "Aman (0 Titik)");
        boolean titikApiBahaya = data.optBoolean("titikApiBahaya", false);

        int picaTotal = data.optInt("picaTotal", 0);
        int picaTelat = data.optInt("picaTelat", 0);
        String picaIsi = data.optString("picaIsi", "Semua tugas PICA selesai");

        String jadwalIsi = data.optString("jadwalIsi", "Tidak ada agenda rapat hari ini");
        String alarmStatus = data.optString("alarmStatus", "Alarm Aktif");

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_dashboard);

            views.setTextViewText(R.id.tv_widget_update_time, waktuKini);
            views.setTextViewText(R.id.tv_widget_cuaca, cuaca);

            views.setTextViewText(R.id.tv_widget_api, titikApi);
            if (titikApiBahaya) {
                views.setTextColor(R.id.tv_widget_api, Color.parseColor("#EF4444")); // red-500
            } else {
                views.setTextColor(R.id.tv_widget_api, Color.parseColor("#34D399")); // emerald-400
            }

            views.setTextViewText(R.id.tv_widget_jadwal_isi, jadwalIsi);
            views.setTextViewText(R.id.tv_widget_alarm_status, alarmStatus);

            views.setTextViewText(R.id.tv_widget_pica_isi, picaIsi);
            if (picaTelat > 0) {
                views.setTextViewText(R.id.tv_widget_pica_badge, picaTelat + " Telat!");
                views.setInt(R.id.tv_widget_pica_badge, "setBackgroundResource", R.drawable.widget_badge_red);
            } else if (picaTotal > 0) {
                views.setTextViewText(R.id.tv_widget_pica_badge, picaTotal + " Open");
                views.setInt(R.id.tv_widget_pica_badge, "setBackgroundResource", R.drawable.widget_badge_emerald);
            } else {
                views.setTextViewText(R.id.tv_widget_pica_badge, "0 Open");
                views.setInt(R.id.tv_widget_pica_badge, "setBackgroundResource", R.drawable.widget_badge_emerald);
            }

            // Click listeners for different sections
            views.setOnClickPendingIntent(R.id.widget_dashboard_root, buatPendingIntent(context, "habitat", 101));
            views.setOnClickPendingIntent(R.id.btn_widget_cuaca, buatPendingIntent(context, "habitat", 102));
            views.setOnClickPendingIntent(R.id.btn_widget_api, buatPendingIntent(context, "habitat", 103));
            views.setOnClickPendingIntent(R.id.btn_widget_jadwal, buatPendingIntent(context, "jadwal", 104));
            views.setOnClickPendingIntent(R.id.btn_widget_pica, buatPendingIntent(context, "pica", 105));

            manager.updateAppWidget(id, views);
        }
    }

    /**
     * Widget PICA bergaya daftar alarm: kiri sisa waktu, kanan judul, ujung kanan
     * penanda alarm. Isinya hanya PICA milik pemakai yang sedang masuk.
     */
    public static void perbaruiPica(Context context, AppWidgetManager manager, int[] ids) {
        JSONObject data = ambilData(context);
        int picaTotal = data.optInt("picaTotal", 0);
        int picaTelat = data.optInt("picaTelat", 0);
        JSONArray items = data.optJSONArray("picaItems");

        int[] barisId = { R.id.pica_item_1, R.id.pica_item_2, R.id.pica_item_3, R.id.pica_item_4 };
        int[] sisaId = { R.id.tv_pica_item_1_sisa, R.id.tv_pica_item_2_sisa, R.id.tv_pica_item_3_sisa, R.id.tv_pica_item_4_sisa };
        int[] waktuId = { R.id.tv_pica_item_1_waktu, R.id.tv_pica_item_2_waktu, R.id.tv_pica_item_3_waktu, R.id.tv_pica_item_4_waktu };
        int[] judulId = { R.id.tv_pica_item_1_title, R.id.tv_pica_item_2_title, R.id.tv_pica_item_3_title, R.id.tv_pica_item_4_title };
        int[] subId = { R.id.tv_pica_item_1_sub, R.id.tv_pica_item_2_sub, R.id.tv_pica_item_3_sub, R.id.tv_pica_item_4_sub };
        int[] alarmId = { R.id.tv_pica_item_1_alarm, R.id.tv_pica_item_2_alarm, R.id.tv_pica_item_3_alarm, R.id.tv_pica_item_4_alarm };

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_pica);

            if (picaTelat > 0) {
                views.setTextViewText(R.id.tv_pica_widget_badge, picaTelat + " Telat / " + picaTotal + " Open");
                views.setInt(R.id.tv_pica_widget_badge, "setBackgroundResource", R.drawable.widget_badge_red);
            } else if (picaTotal > 0) {
                views.setTextViewText(R.id.tv_pica_widget_badge, picaTotal + " Open");
                views.setInt(R.id.tv_pica_widget_badge, "setBackgroundResource", R.drawable.widget_badge_emerald);
            } else {
                views.setTextViewText(R.id.tv_pica_widget_badge, "Semua Selesai");
                views.setInt(R.id.tv_pica_widget_badge, "setBackgroundResource", R.drawable.widget_badge_emerald);
            }

            int jumlah = items == null ? 0 : items.length();
            for (int i = 0; i < barisId.length; i++) {
                if (i < jumlah) {
                    JSONObject it = items.optJSONObject(i);
                    String sisa = it.optString("sisa", "—");
                    boolean telat = it.optBoolean("telat", false);
                    boolean alarm = it.optBoolean("alarm", false);

                    views.setViewVisibility(barisId[i], View.VISIBLE);
                    views.setTextViewText(sisaId[i], sisa);
                    // Merah bila telat, oranye bila hari ini, abu untuk sisanya.
                    int warna = telat ? 0xFFF87171 : (sisa.startsWith("HARI INI") ? 0xFFFBBF24 : 0xFFE4E4E7);
                    views.setTextColor(sisaId[i], warna);
                    views.setTextViewText(waktuId[i], it.optString("waktu", "—"));
                    views.setTextViewText(judulId[i], it.optString("judul", "—"));
                    views.setTextViewText(subId[i], it.optString("id", "") + " · " + it.optString("pic", "—"));
                    views.setTextViewText(alarmId[i], alarm ? "⏰" : "○");
                    views.setTextColor(alarmId[i], alarm ? 0xFF34D399 : 0xFF52525B);
                } else if (i == 0) {
                    views.setViewVisibility(barisId[0], View.VISIBLE);
                    views.setTextViewText(sisaId[0], "AMAN");
                    views.setTextColor(sisaId[0], 0xFF34D399);
                    views.setTextViewText(waktuId[0], "—");
                    views.setTextViewText(judulId[0], "Tidak ada PICA terbuka untukmu");
                    views.setTextViewText(subId[0], "Semua tugas selesai");
                    views.setTextViewText(alarmId[0], "");
                } else {
                    views.setViewVisibility(barisId[i], View.GONE);
                }
            }

            views.setOnClickPendingIntent(R.id.widget_pica_root, buatPendingIntent(context, "pica", 201));
            manager.updateAppWidget(id, views);
        }
    }

    /** Intent untuk tombol ‹ › di widget kalender. */
    private static PendingIntent intentBulan(Context context, String aksi, int reqCode) {
        Intent intent = new Intent(context, KalenderWidgetProvider.class);
        intent.setAction(aksi);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, reqCode, intent, flags);
    }

    /** Warna titik penanda per lapisan kalender (sama dengan layar KALENDER). */
    private static int warnaLapisan(char kode) {
        switch (kode) {
            case 'L': return 0xFFEF4444; // libur nasional
            case 'T': return 0xFFF59E0B; // tenggat PICA
            case 'R': return 0xFF818CF8; // rapat
            case 'M': return 0xFF22D3EE; // rencana tim
            case 'S': return 0xFF34D399; // rencana saya
            case 'A': return 0xFFA1A1AA; // anggota lain
            case 'O': return 0xFF2DD4BF; // roster saya
            default: return 0xFFFBBF24;
        }
    }

    private static final String[] NAMA_BULAN = {
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    };

    /**
     * Kotak bulan 6×7. Tanggal diambil dari kalender Jawa/Gregorian perangkat,
     * titik penanda dari data yang dikirim aplikasi (peta tanggal → kode lapisan).
     */
    public static void perbaruiKalender(Context context, AppWidgetManager manager, int[] ids) {
        JSONObject data = ambilData(context);
        JSONObject titik = data.optJSONObject("kalenderTitik");
        String hariIni = data.optString("kalenderHariIni", "");
        String ringkas = data.optString("kalenderRingkas", "Buka aplikasi untuk menyegarkan");

        int geser = KalenderWidgetProvider.geseranBulan(context);
        java.util.Calendar kal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("Asia/Makassar"));
        if (hariIni.length() == 10) {
            kal.set(Integer.parseInt(hariIni.substring(0, 4)), Integer.parseInt(hariIni.substring(5, 7)) - 1, 1);
        } else {
            kal.set(java.util.Calendar.DAY_OF_MONTH, 1);
        }
        kal.add(java.util.Calendar.MONTH, geser);
        int tahun = kal.get(java.util.Calendar.YEAR);
        int bulan = kal.get(java.util.Calendar.MONTH);

        // Senin sebagai kolom pertama.
        int hariPertama = (kal.get(java.util.Calendar.DAY_OF_WEEK) + 5) % 7;
        int jumlahHari = kal.getActualMaximum(java.util.Calendar.DAY_OF_MONTH);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_kalender);
            views.setTextViewText(R.id.tv_kal_bulan, NAMA_BULAN[bulan] + " " + tahun);
            views.setTextViewText(R.id.tv_kal_ringkas, ringkas);

            for (int i = 0; i < 42; i++) {
                int idTgl = context.getResources().getIdentifier("kal_tgl_" + i, "id", context.getPackageName());
                int idTitik = context.getResources().getIdentifier("kal_titik_" + i, "id", context.getPackageName());
                int tanggal = i - hariPertama + 1;

                if (tanggal < 1 || tanggal > jumlahHari) {
                    views.setTextViewText(idTgl, " ");
                    views.setTextViewText(idTitik, " ");
                    continue;
                }

                String iso = String.format(java.util.Locale.US, "%04d-%02d-%02d", tahun, bulan + 1, tanggal);
                String kode = titik == null ? "" : titik.optString(iso, "");
                boolean minggu = (i % 7) == 6;
                boolean libur = kode.indexOf('L') >= 0;
                boolean ini = iso.equals(hariIni);

                views.setTextViewText(idTgl, String.valueOf(tanggal));
                views.setTextColor(idTgl, ini ? 0xFF000000 : (minggu || libur ? 0xFFF87171 : 0xFFE4E4E7));
                views.setInt(idTgl, "setBackgroundResource", ini ? R.drawable.widget_badge_blue : 0);

                if (kode.isEmpty()) {
                    views.setTextViewText(idTitik, " ");
                } else {
                    // Satu titik per lapisan, maksimal tiga agar tidak penuh.
                    StringBuilder t = new StringBuilder();
                    for (int k = 0; k < kode.length() && k < 3; k++) t.append('•');
                    views.setTextViewText(idTitik, t.toString());
                    views.setTextColor(idTitik, warnaLapisan(kode.charAt(0)));
                }
            }

            views.setOnClickPendingIntent(R.id.btn_kal_mundur, intentBulan(context, KalenderWidgetProvider.AKSI_MUNDUR, 301));
            views.setOnClickPendingIntent(R.id.btn_kal_maju, intentBulan(context, KalenderWidgetProvider.AKSI_MAJU, 302));
            views.setOnClickPendingIntent(R.id.btn_kal_atur, buatPendingIntent(context, "jadwal", 303));
            views.setOnClickPendingIntent(R.id.widget_kalender_root, buatPendingIntent(context, "jadwal", 304));
            manager.updateAppWidget(id, views);
        }
    }

    public static void perbaruiJadwal(Context context, AppWidgetManager manager, int[] ids) {
        JSONObject data = ambilData(context);
        String alarmStatus = data.optString("alarmStatus", "Alarm Aktif");
        JSONArray items = data.optJSONArray("jadwalItems");

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_jadwal);
            views.setTextViewText(R.id.tv_jadwal_widget_alarm_badge, alarmStatus);

            // Event 1
            if (items != null && items.length() > 0) {
                JSONObject ev1 = items.optJSONObject(0);
                views.setViewVisibility(R.id.jadwal_item_1, View.VISIBLE);
                views.setTextViewText(R.id.tv_jadwal_item_1_title, ev1.optString("judul", "—"));
                views.setTextViewText(R.id.tv_jadwal_item_1_sub, "⏰ " + ev1.optString("jam", "") + " WITA");
            } else {
                views.setViewVisibility(R.id.jadwal_item_1, View.VISIBLE);
                views.setTextViewText(R.id.tv_jadwal_item_1_title, "Tidak ada agenda rapat hari ini");
                views.setTextViewText(R.id.tv_jadwal_item_1_sub, "—");
            }

            // Event 2
            if (items != null && items.length() > 1) {
                JSONObject ev2 = items.optJSONObject(1);
                views.setViewVisibility(R.id.jadwal_item_2, View.VISIBLE);
                views.setTextViewText(R.id.tv_jadwal_item_2_title, ev2.optString("judul", "—"));
                views.setTextViewText(R.id.tv_jadwal_item_2_sub, "⏰ " + ev2.optString("jam", "") + " WITA");
            } else {
                views.setViewVisibility(R.id.jadwal_item_2, View.GONE);
            }

            // Event 3
            if (items != null && items.length() > 2) {
                JSONObject ev3 = items.optJSONObject(2);
                views.setViewVisibility(R.id.jadwal_item_3, View.VISIBLE);
                views.setTextViewText(R.id.tv_jadwal_item_3_title, ev3.optString("judul", "—"));
                views.setTextViewText(R.id.tv_jadwal_item_3_sub, "⏰ " + ev3.optString("jam", "") + " WITA");
            } else {
                views.setViewVisibility(R.id.jadwal_item_3, View.GONE);
            }

            views.setOnClickPendingIntent(R.id.widget_jadwal_root, buatPendingIntent(context, "jadwal", 301));
            manager.updateAppWidget(id, views);
        }
    }
}
