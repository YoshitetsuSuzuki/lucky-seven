import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yoshitetsu.luckyseven',
  appName: 'ラッキーセブン',
  webDir: 'apps/web/dist',
  ios: {
    contentInset: 'never',
    // 注: WKWebView のカスタム URL スキームは ASCII のみ有効なため、この値は
    //     Capacitor 側で無視され、実際のオリジンは capacitor://localhost になる。
    //     （実機/シミュレータで確認済み。クラッシュはしない）
    scheme: 'ラッキーセブン',
    // セーフエリア外（ステータスバー下・ホームインジケータ周辺）が白く抜けないように
    backgroundColor: '#0a0e1a',
  },
  server: {
    // 外部サイトはアプリ内 WebView で開かず、@capacitor/browser (SFSafariViewController) を使う
    allowNavigation: [],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0a0e1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0e1a',
    },
  },
};

export default config;
