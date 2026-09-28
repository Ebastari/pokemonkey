package id.ebl.pokemonkey;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        inisialisasiChannelNotifikasi();
    }

    private void inisialisasiChannelNotifikasi() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

            // 1. Channel "default" (digunakan oleh BackgroundRunner untuk pengingat terjadwal latar)
            buatAtauPerbaruiChannel(manager, "default", "Pengingat POKEMONKEY",
                "Pengingat harian terjadwal dan notifikasi sistem dengan pop-up di layar",
                NotificationManager.IMPORTANCE_HIGH, soundUri, audioAttributes);

            // 2. Channel "harian_channel" (pengingat lokal 07.00, 12.00, 17.00 WITA)
            buatAtauPerbaruiChannel(manager, "harian_channel", "Pengingat Harian (PICA, Info, XP)",
                "Notifikasi terjadwal 07.00, 12.00, 17.00 WITA dengan banner mengambang",
                NotificationManager.IMPORTANCE_HIGH, soundUri, audioAttributes);

            // 3. Channel "alarm_channel" (alarm agenda & meeting mendesak)
            AudioAttributes alarmAudio = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            buatAtauPerbaruiChannel(manager, "alarm_channel", "Alarm & Pengingat Meeting",
                "Alarm suara dan pop-up banner mengambang saat jadwal acara tiba",
                NotificationManager.IMPORTANCE_HIGH, soundUri, alarmAudio);
        }
    }

    private void buatAtauPerbaruiChannel(NotificationManager manager, String channelId, String nama,
                                         String deskripsi, int importance, Uri soundUri, AudioAttributes audioAttributes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel ada = manager.getNotificationChannel(channelId);
        // Jika channel sudah ada tetapi tingkat kepentingannya di bawah HIGH (tidak muncul pop-up),
        // hapus dan buat ulang dengan IMPORTANCE_HIGH agar muncul pop-up mengambang di layar HP.
        if (ada != null && ada.getImportance() < NotificationManager.IMPORTANCE_HIGH) {
            manager.deleteNotificationChannel(channelId);
            ada = null;
        }

        if (ada == null) {
            NotificationChannel channel = new NotificationChannel(channelId, nama, importance);
            channel.setDescription(deskripsi);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 250, 250, 250});
            channel.enableLights(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            if (soundUri != null && audioAttributes != null) {
                channel.setSound(soundUri, audioAttributes);
            }
            manager.createNotificationChannel(channel);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.hasExtra("tab")) {
            String tab = intent.getStringExtra("tab");
            if (tab != null && getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('pokemonkey:buka-tab', { detail: '" + tab + "' }));",
                        null
                    );
                });
            }
        }
    }
}
