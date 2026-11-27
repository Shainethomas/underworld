package com.dynamicnext.underworld;

import android.os.Build;
import android.view.Display;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The screen's refresh rate, for the game's frame pacing (FrameGovernor).
 * Measured from frame timing alone, a busy GPU holds back the WebView's vsync
 * callbacks and a 90 Hz panel reads as 45 Hz, so the game would pace to the
 * wrong rates; the system knows the real one.
 */
@CapacitorPlugin(name = "Display")
public class DisplayPlugin extends Plugin {

    @PluginMethod
    public void refreshRate(PluginCall call) {
        Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            ? getActivity().getDisplay()
            : getActivity().getWindowManager().getDefaultDisplay();
        JSObject result = new JSObject();
        result.put("hz", display != null ? display.getRefreshRate() : 0);
        call.resolve(result);
    }
}
