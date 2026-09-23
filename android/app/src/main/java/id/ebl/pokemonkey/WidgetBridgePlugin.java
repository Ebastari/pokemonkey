package id.ebl.pokemonkey;

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
}
