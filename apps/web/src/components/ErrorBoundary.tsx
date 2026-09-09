import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { message: string | null }

/** 描画中の例外で画面が真っ白になるのを防ぐ最後の砦 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(e: unknown): State {
    return { message: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error(e, info);
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-display text-lg font-extrabold text-rose">問題が発生しました</p>
        <p className="break-all text-sm text-muted">{this.state.message}</p>
        <button
          onClick={() => location.reload()}
          className="gold-foil rounded-2xl px-6 py-3 font-display font-extrabold"
        >
          再読み込み
        </button>
      </div>
    );
  }
}
