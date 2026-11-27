package com.dynamicnext.underworld;

import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DisplayPlugin.class);
        super.onCreate(savedInstanceState);
        // Under memory pressure Android can kill the WebView's render process.
        // Left unhandled, that takes the whole app down. Rebuild the activity
        // instead (a fresh WebView): the game sees it was cut off mid-scene and
        // continues at the beat it was on (src/platform/recovery.ts).
        bridge.addWebViewListener(
            new WebViewListener() {
                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    runOnUiThread(MainActivity.this::recreate);
                    return true;
                }
            }
        );
    }
}
