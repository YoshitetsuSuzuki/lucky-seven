import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';

const root = document.getElementById('root')!;

// 設定ミス（環境変数未設定など）で真っ白にならないよう、必ずメッセージを出す。
// App は動的 import：依存モジュールの評価時に投げられる例外もここで捕まえるため。
async function bootstrap() {
  try {
    const { default: App } = await import('./App');
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <HashRouter>
          <App />
        </HashRouter>
      </React.StrictMode>,
    );
  } catch (e) {
    root.textContent = e instanceof Error ? e.message : String(e);
  }
}

void bootstrap();
