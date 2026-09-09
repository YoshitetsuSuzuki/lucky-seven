import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';

// 書体は同梱する（実行時に外部サーバーへ取りに行かない）。
// どちらも SIL Open Font License 1.1。
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/zen-kaku-gothic-new/400.css';
import '@fontsource/zen-kaku-gothic-new/700.css';
import '@fontsource/zen-kaku-gothic-new/900.css';

import './index.css';

const root = document.getElementById('root')!;

// 設定ミス（環境変数未設定など）で真っ白にならないよう、必ずメッセージを出す。
// App は動的 import：依存モジュールの評価時に投げられる例外もここで捕まえるため。
async function bootstrap() {
  try {
    const { default: App } = await import('./App');
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <HashRouter>
            <App />
          </HashRouter>
        </ErrorBoundary>
      </React.StrictMode>,
    );
  } catch (e) {
    console.error(e);
    const box = document.createElement('div');
    box.className = 'p-6 text-rose-400';
    box.textContent = e instanceof Error ? e.message : String(e);
    root.replaceChildren(box);
  }
}

void bootstrap();
