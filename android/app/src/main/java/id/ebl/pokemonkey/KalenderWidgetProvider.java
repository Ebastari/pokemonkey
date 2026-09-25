package id.ebl.pokemonkey;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * Widget kalender bulanan. Bulan yang sedang dilihat disimpan sebagai geseran
 * (0 = bulan ini, -1 = bulan lalu) supaya tombol ‹ › bekerja tanpa membuka aplikasi.
 */
public class KalenderWidgetProvider extends AppWidgetProvider {
    public static final String AKSI_MUNDUR = "id.ebl.pokemonkey.KALENDER_MUNDUR";
    public static final String AKSI_MAJU = "id.ebl.pokemonkey.KALENDER_MAJU";
    private static final String PREF = "pokemonkey_widget";
    private static final String KUNCI_GESER = "kalender_geser";

    public static int geseranBulan(Context context) {
        SharedPreferences pref = context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        return pref.getInt(KUNCI_GESER, 0);
    }

    private static void simpanGeseran(Context context, int nilai) {
        // Dibatasi ±2 bulan: data acara yang dikirim aplikasi hanya sekitar rentang itu.
        int aman = Math.max(-2, Math.min(2, nilai));
        context.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putInt(KUNCI_GESER, aman).apply();
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        WidgetHelper.perbaruiKalender(context, appWidgetManager, appWidgetIds);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String aksi = intent.getAction();
        if (AKSI_MUNDUR.equals(aksi) || AKSI_MAJU.equals(aksi)) {
            simpanGeseran(context, geseranBulan(context) + (AKSI_MAJU.equals(aksi) ? 1 : -1));
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, KalenderWidgetProvider.class));
            if (ids != null && ids.length > 0) WidgetHelper.perbaruiKalender(context, manager, ids);
        }
    }

    @Override
    public void onEnabled(Context context) {
        simpanGeseran(context, 0); // widget baru selalu mulai dari bulan ini
    }
}
