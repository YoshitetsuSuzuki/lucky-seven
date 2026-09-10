import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SoundControls from '../components/SoundControls';
import { CardBack } from '../components/CardView';
import { ThemeCards } from '../components/ThemePicker';
import { useTheme } from '../lib/theme';
import { useGoBack } from '../hooks/useGoBack';
import { legalUrl, SUPPORT_EMAIL } from '../lib/links';
import { APP_NAME, APP_VERSION } from '../version';

const PREFIX = 'lucky7:';

/** 端末内に保存した設定・セッションをすべて消す */
function clearStoredData(): number {
  let removed = 0;
  for (const store of [localStorage, sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      for (const k of keys) {
        store.removeItem(k);
        removed++;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="lacquer rounded-3xl p-4">
      <h2 className="font-display text-[12px] font-extrabold tracking-[0.28em] text-gold/75">{title}</h2>
      <div className="mt-2.5 space-y-2.5 text-[13.5px] leading-[1.85] text-cream/75">{children}</div>
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-edge/10 bg-ink3/70 px-4 text-[14px] font-bold text-cream/85 transition active:scale-[.99]"
    >
      {children}
      <span aria-hidden className="text-cream/35">
        ↗
      </span>
    </a>
  );
}

export default function About() {
  const back = useGoBack();
  const theme = useTheme();
  const [cleared, setCleared] = useState<number | null>(null);

  const onClear = () => {
    const ok = window.confirm(
      'この端末に保存したデータ（ニックネーム・音の設定・ルームへの復帰情報）をすべて消去します。\nよろしいですか？',
    );
    if (!ok) return;
    setCleared(clearStoredData());
  };

  return (
    <div className="mx-auto max-w-lg px-4" style={{ paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))' }}>
      <header className="sticky-safe sticky z-10 flex items-center gap-3 border-b border-edge/8 bg-ink/95 px-0.5 pb-3 pt-3 backdrop-blur">
        <h1 className="font-display text-xl font-extrabold tracking-tight">
          設定・情報<span className="ml-2 text-[11px] font-extrabold tracking-[0.3em] text-gold/60">ABOUT</span>
        </h1>
        <button
          type="button"
          onClick={back}
          className="ml-auto flex min-h-[40px] shrink-0 items-center rounded-full border border-edge/12 bg-edge/5 px-4 text-[13px] font-bold leading-none text-cream/85 transition active:scale-95"
        >
          戻る
        </button>
      </header>

      <div className="space-y-3.5 pt-4">
        <section className="felt flex items-center gap-4 rounded-3xl p-4">
          <div className="relative shrink-0" style={{ width: 56, height: 78 }}>
            <CardBack size="md" className="absolute inset-0" style={{ transform: 'rotate(-8deg) translateX(-4px)', opacity: 0.75 }} />
            <CardBack size="md" className="absolute inset-0" style={{ transform: 'rotate(4deg)' }} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[10px] font-extrabold tracking-[0.4em] text-feltgold/80">{theme.eyebrow}</p>
            <h2 className="font-display text-[30px] font-extrabold leading-tight tracking-tight text-feltink">
              ラッキー<span className="text-feltgold">7</span>
            </h2>
            <p className="mt-0.5 text-[12px] text-feltink/70">
              {APP_NAME} バージョン {APP_VERSION}
            </p>
          </div>
        </section>

        <Section title="見た目のテーマ">
          <p className="text-[13px]">
            卓の色・カード・空気ごと切り替わります。選ぶとすぐに反映され、この端末に覚えておきます。
          </p>
          <ThemeCards />
        </Section>

        <Section title="音の設定">
          <div className="flex items-start gap-3">
            <SoundControls className="pt-0.5" />
            <p className="min-w-0 flex-1 text-[13px]">
              <b className="text-cream/95">ホーム・ロビー用</b>
              <br />
              待っている間の BGM と、カードをめくる音・バースト音などの効果音の切り替えです。
            </p>
          </div>
          <div className="flex items-start gap-3 border-t border-edge/8 pt-2.5">
            <SoundControls scope="table" className="pt-0.5" />
            <p className="min-w-0 flex-1 text-[13px]">
              <b className="text-cream/95">対局中（卓・結果）用</b>
              <br />
              卓では BGM を既定で鳴らしません。ここか卓のヘッダーでオンにしたときだけ流れます。効果音の設定は共通です。
            </p>
          </div>
          <p className="text-[12.5px] text-cream/55">
            音が出ないときは、端末のサイレントスイッチと音量もご確認ください。
          </p>
        </Section>

        <Section title="遊び方">
          <Link
            to="/help"
            className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/[0.07] px-4 text-[14px] font-bold text-gold transition active:scale-[.99]"
          >
            ルールと画面の使い方
            <span aria-hidden className="text-gold/50">
              ›
            </span>
          </Link>
        </Section>

        <Section title="規約とサポート">
          <div className="space-y-2">
            <ExternalLink href={legalUrl('privacy')}>プライバシーポリシー</ExternalLink>
            <ExternalLink href={legalUrl('terms')}>利用規約</ExternalLink>
            <ExternalLink href={legalUrl('support')}>サポート・よくある質問</ExternalLink>
          </div>
          <p className="text-[12.5px] text-cream/55">
            お問い合わせ:{' '}
            <a className="text-cream/80 underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </Section>

        <Section title="保存データ">
          <p>
            この端末には、ニックネーム・音の設定・参加中のルームへ戻るための情報だけを保存しています。消去すると、進行中のルームには戻れなくなります。
          </p>
          <button
            type="button"
            onClick={onClear}
            className="min-h-[48px] w-full rounded-2xl border border-rose/40 bg-rose/10 px-4 text-[14px] font-bold text-rose transition active:scale-[.99]"
          >
            保存データを消去
          </button>
          {cleared !== null && (
            <p className="text-[13px] font-bold text-cream/80">保存データを消去しました（{cleared}件）。</p>
          )}
        </Section>

        <Section title="クレジット">
          <p>
            書体: Bricolage Grotesque（SIL Open Font License 1.1） / Zen Kaku Gothic New（SIL Open Font License 1.1）
          </p>
          <p>通信・データベース: Supabase</p>
          <p className="rounded-2xl border border-edge/10 bg-edge/5 px-3 py-2 text-[12.5px] text-cream/70">
            このゲームはオリジナル作品です。他社のカードゲーム製品とは関係ありません。
          </p>
          <p className="text-[12.5px] text-cream/55">
            運営: 株式会社インフィニティ
          </p>
          <p className="text-[12.5px] text-cream/55">© 2026 Infinity Inc. / インフィニティゲームズ</p>
        </Section>
      </div>
    </div>
  );
}
