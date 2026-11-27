import type { CapacitorConfig } from '@capacitor/cli'

// Native shells for Android and iOS around the built web game (dist/).
// See ARCHITECTURE.md, "Mobile delivery".
const config: CapacitorConfig = {
  appId: 'com.dynamicnext.underworld',
  appName: 'Underworld',
  webDir: 'dist',
  // the game is dark from the first frame: no white flash behind the WebView
  backgroundColor: '#131418',
  android: {
    // assets are served from https://localhost, so WebGPU/WebGL and fetch() behave as on the web
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
    // keeps the WebView from scrolling or bouncing behind the game
    scrollEnabled: false,
  },
  plugins: {
    StatusBar: { overlaysWebView: true, style: 'DARK', backgroundColor: '#00000000' },
  },
}

export default config
