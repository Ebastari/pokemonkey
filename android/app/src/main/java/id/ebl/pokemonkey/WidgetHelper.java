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

    public static void perbaruiPica(Context context, AppWidgetManager manager, int[] ids) {
        JSONObject data = ambilData(context);
        int picaTotal = data.optInt("picaTotal", 0);
        int picaTelat = data.optInt("picaTelat", 0);
        JSONArray items = data.optJSONArray("picaItems");

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

            // Item 1
            if (items != null && items.length() > 0) {
                JSONObject it1 = items.optJSONObject(0);
                views.setViewVisibility(R.id.pica_item_1, View.VISIBLE);
                views.setTextViewText(R.id.tv_pica_item_1_title, it1.optString("judul", "—"));
                views.setTextViewText(R.id.tv_pica_item_1_sub, "PIC: " + it1.optString("pic", "—") + " · Tenggat: " + it1.optString("due_date", "—"));
            } else {
                views.setViewVisibility(R.id.pica_item_1, View.VISIBLE);
                views.setTextViewText(R.id.tv_pica_item_1_title, "Semua tugas PICA selesai");
                views.setTextViewText(R.id.tv_pica_item_1_sub, "Tidak ada temuan terbuka");
            }

            // Item 2
            if (items != null && items.length() > 1) {
                JSONObject it2 = items.optJSONObject(1);
                views.setViewVisibility(R.id.pica_item_2, View.VISIBLE);
                views.setTextViewText(R.id.tv_pica_item_2_title, it2.optString("judul", "—"));
                views.setTextViewText(R.id.tv_pica_item_2_sub, "PIC: " + it2.optString("pic", "—") + " · Tenggat: " + it2.optString("due_date", "—"));
            } else {
                views.setViewVisibility(R.id.pica_item_2, View.GONE);
            }

            // Item 3
            if (items != null && items.length() > 2) {
                JSONObject it3 = items.optJSONObject(2);
                views.setViewVisibility(R.id.pica_item_3, View.VISIBLE);
                views.setTextViewText(R.id.tv_pica_item_3_title, it3.optString("judul", "—"));
                views.setTextViewText(R.id.tv_pica_item_3_sub, "PIC: " + it3.optString("pic", "—") + " · Tenggat: " + it3.optString("due_date", "—"));
            } else {
                views.setViewVisibility(R.id.pica_item_3, View.GONE);
            }

            views.setOnClickPendingIntent(R.id.widget_pica_root, buatPendingIntent(context, "pica", 201));
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
