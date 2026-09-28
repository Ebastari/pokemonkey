package id.ebl.pokemonkey;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void perbaruiDataWidget(PluginCall call) {
        JSObject data = call.getData();
        if (data != null) {
            WidgetHelper.simpanData(getContext(), data.toString());
            WidgetHelper.perbaruiSemuaWidget(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void ambilTabAwal(PluginCall call) {
        JSObject ret = new JSObject();
        if (getActivity() != null && getActivity().getIntent() != null) {
            String tab = getActivity().getIntent().getStringExtra("tab");
            if (tab != null) {
                ret.put("tab", tab);
                getActivity().getIntent().removeExtra("tab");
            }
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void bukaPengaturanNotifikasi(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal membuka setelan notifikasi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void bukaPengaturanBaterai(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal membuka setelan baterai: " + e.getMessage());
        }
    }
}
