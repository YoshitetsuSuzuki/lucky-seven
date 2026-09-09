import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Card } from '@lucky7/engine';
import { isNative } from '../lib/platform';
import CardView from './CardView';

/* ---------- 見本カード（本物の CardView をそのまま挿絵に使う） ---------- */

const num = (v: number): Card => ({ id: `help-n${v}`, kind: 'number', value: v });
const num2 = (v: number): Card => ({ id: `help-n${v}-b`, kind: 'number', value: v });
const add = (v: number): Card => ({ id: `help-a${v}`, kind: 'add', value: v });
const MUL: Card = { id: 'help-mul', kind: 'mul' };
const action = (a: 'freeze' | 'triple' | 'insurance'): Card => ({ id: `help-${a}`, kind: 'action', action: a });

/* ---------- 部品 ---------- */

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="lacquer rounded-3xl p-4">
      <h2 className="font-display text-[12px] font-extrabold tracking-[0.28em] text-gold/75">{title}</h2>
      {lead && <p className="mt-1.5 text-[15px] font-bold leading-snug text-cream/95">{lead}</p>}
      <div className="mt-2.5 space-y-2.5 text-[13.5px] leading-[1.85] text-cream/75">{children}</div>
    </section>
  );
}

function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>{children}</div>;
}

/** 用語の見出し（氷結・三連・保険など） */
function Term({ card, name, children }: { card: Card; name: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <CardView card={card} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-cream/95">{name}</p>
        <p className="mt-0.5 text-[13px] leading-[1.8] text-cream/70">{children}</p>
      </div>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-gold/20 bg-gold/[0.06] px-3 py-2 text-[12.5px] leading-[1.8] text-cream/75">
      {children}
    </p>
  );
}

/* ---------- 本文 ---------- */

export function HelpContent() {
  return (
    <div className="space-y-3.5">
      <Section title="目的" lead="数字を7種類そろえるか、伸びたところで降りる。">
        <p>
          手番ごとにカードを1枚ずつ引き、場の数字カードを増やしていきます。数字が
          <b className="text-cream/95">7種類</b>そろえば大きなボーナス。ただし同じ数字が2枚来た瞬間、そのラウンドの得点は
          <b className="text-rose">0</b>です。
        </p>
        <p>
          各ラウンドの最初に、全員へ1枚ずつ配られます（配られたアクションカードはその場で解決）。そのあと座席順に手番が回ります。
        </p>
        <p>
          ラウンドの得点を積み上げ、ホストが決めた<b className="text-cream/95">目標点（100 / 200 / 300点）</b>か
          <b className="text-cream/95">ラウンド数（3 / 5 / 10）</b>で勝負が決まります。最高点の人が勝ち、同点なら同順位です。
        </p>
      </Section>

      <Section title="手番でできること" lead="「引く」か「降りる」の2択。">
        <div aria-hidden className="flex gap-2.5 py-0.5">
          <div className="gold-foil flex-1 rounded-2xl py-3.5 text-center font-display text-[19px] font-extrabold tracking-wide text-[#3a2a06] shadow-[0_10px_30px_-12px_rgba(242,193,78,.8)]">
            引く
          </div>
          <div className="flex-1 rounded-2xl border border-white/12 bg-ink3 py-3.5 text-center font-display text-[19px] font-extrabold tracking-wide text-cream/85">
            降りる
          </div>
        </div>
        <p>
          <b className="text-cream/95">引く</b>… 山札から1枚めくります。数字カードは自分の場に並び、修飾カードは得点を押し上げ、アクションカードはその場で効果が起きます。
        </p>
        <p>
          <b className="text-cream/95">降りる</b>… その時点の場札で得点を確定し、そのラウンドから離れます。バーストではないので、点はきちんと入ります。
        </p>
      </Section>

      <Section title="バースト" lead="同じ数字の2枚目で、そのラウンドは0点。">
        <Row className="py-0.5">
          <CardView card={num(5)} size="md" />
          <CardView card={num2(5)} size="md" marked />
          <span className="ml-2 font-display text-2xl font-extrabold text-rose">= 0点</span>
        </Row>
        <p>
          自分の場に同じ数字の2枚目が来ると、そのラウンドの得点は 0 になり、ラウンドから離脱します（保険を持っていれば助かります）。
        </p>
        <p>
          バーストしても手札は消えません。全員の場札は<b className="text-cream/95">次のラウンドが始まるまで表示されたまま</b>残るので、誰が何を持っていたかを後から確認できます。
        </p>
      </Section>

      <Section title="カードの種類" lead="全94枚。数字79枚・アクション9枚・修飾6枚。">
        <div>
          <p className="mb-1.5 font-bold text-cream/95">数字（0〜12）</p>
          <Row>
            {Array.from({ length: 13 }, (_, v) => (
              <CardView key={v} card={num(v)} size="sm" />
            ))}
          </Row>
          <p className="mt-2">
            枚数はその数字と同じです（1は1枚、2は2枚 … 12は12枚）。<b className="text-cream/95">0だけは1枚</b>しかありません。大きい数字ほど点は高く、そして重なりやすくなります。
          </p>
        </div>

        <div className="pt-1">
          <p className="mb-1.5 font-bold text-cream/95">修飾（各1枚）</p>
          <Row>
            {[2, 4, 6, 8, 10].map((v) => (
              <CardView key={v} card={add(v)} size="sm" />
            ))}
            <CardView card={MUL} size="sm" />
          </Row>
          <p className="mt-2">
            <b className="text-cream/95">+2 〜 +10</b> は最後に足す点。<b className="text-cream/95">×2</b> は数字の合計を2倍にします。修飾カードでは決してバーストしません。
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <p className="font-bold text-cream/95">アクション（各3枚）</p>
          <Term card={action('freeze')} name="氷結">
            引いた人が現役のプレイヤー1人（自分でも可）を選びます。選ばれた人は、その場で「降りる」扱いになり、その時点の得点で確定します。
          </Term>
          <Term card={action('triple')} name="三連">
            選ばれた1人（自分でも可）が、続けて3枚引きます。途中でバーストしたら残りは引きません。3枚の中に出た氷結・三連は、3枚を引き終えてから順に解決します。
          </Term>
          <Term card={action('insurance')} name="保険">
            持てるのは1枚まで。バーストしたとき、保険と重なったカードを捨てて、そのまま続けられます。2枚目の保険を引いたら、保険を持っていない現役プレイヤー1人に渡します（渡す相手は自分で選択。該当者がいなければ捨て札）。
          </Term>
          <Note>
            保険は<b className="text-cream/90">三連の途中で引いた瞬間から有効</b>です。残りの枚数で数字が重なっても、その保険が守ってくれます。
          </Note>
        </div>
      </Section>

      <Section title="ラッキーセブン達成" lead="数字が7種類そろえば +15点。その瞬間に全員のラウンドが終了。">
        <Row className="py-0.5">
          {[0, 2, 3, 5, 7, 9, 11].map((v) => (
            <CardView key={v} card={num(v)} size="sm" />
          ))}
          <span className="ml-1.5 font-display text-xl font-extrabold text-gold [text-shadow:0_0_20px_rgba(242,193,78,.5)]">+15</span>
        </Row>
        <p>
          場の数字カードが7種類（0も1種類として数えます）そろった瞬間に +15点。その時点で<b className="text-cream/95">全員のラウンドが終了</b>し、まだ現役だった人はその場札のまま得点が確定します。
        </p>
        <Note>
          <b className="text-cream/90">三連の途中で達成した場合</b>は、残りの枚数を最後まで引き切ってからラウンドが終わります。達成後に引いたカードは、まだ持っていない数字と修飾なら場に加わって加点され、重なった数字とアクションは捨て札になります（達成は確定済みなので、もうバーストしません）。
        </Note>
      </Section>

      <Section title="得点の計算" lead="数字合計 → ×2 → 修飾を加算 → 達成ボーナス +15。">
        <div className="felt rounded-2xl px-3.5 py-3 font-display text-[13px] font-bold leading-[2] tracking-wide text-cream/90">
          <div>① 場の数字カードを合計する</div>
          <div>② ×2 があれば、その合計を2倍にする</div>
          <div>③ 修飾（+2〜+10）の合計を足す</div>
          <div>④ 7種類そろっていれば +15</div>
          <div className="text-rose">⑤ バーストしていれば 0</div>
        </div>

        <div className="pt-0.5">
          <p className="font-bold text-cream/95">例1</p>
          <Row className="my-1">
            <CardView card={num(3)} size="sm" />
            <CardView card={num(7)} size="sm" />
            <CardView card={num(12)} size="sm" />
            <CardView card={add(4)} size="sm" />
          </Row>
          <p className="font-display text-[13px] font-bold text-cream/85">3 + 7 + 12 = 22 → +4 → <span className="text-gold">26点</span></p>
        </div>

        <div className="pt-1">
          <p className="font-bold text-cream/95">例2（×2 あり）</p>
          <Row className="my-1">
            <CardView card={num(1)} size="sm" />
            <CardView card={num(4)} size="sm" />
            <CardView card={num(9)} size="sm" />
            <CardView card={MUL} size="sm" />
            <CardView card={add(10)} size="sm" />
          </Row>
          <p className="font-display text-[13px] font-bold text-cream/85">
            1 + 4 + 9 = 14 → ×2 = 28 → +10 → <span className="text-gold">38点</span>
          </p>
        </div>

        <div className="pt-1">
          <p className="font-bold text-cream/95">例3（7種類そろった）</p>
          <p className="mt-1 font-display text-[13px] font-bold text-cream/85">
            0 + 2 + 3 + 5 + 7 + 9 + 11 = 37 → +15 → <span className="text-gold">52点</span>
          </p>
        </div>

        <p className="pt-1">数字が1枚もなく修飾カードだけの場合も、修飾の分は加算されます（×2 だけなら 0点です）。</p>
      </Section>

      <Section title="ラウンドとゲームの終わり">
        <p>
          全員が「降りる」かバーストした時点、または誰かがラッキーセブンを達成した瞬間に、そのラウンドは終了します。集計を確認したらホストが「次のラウンドへ」を押します。
        </p>
        <p>ラウンドが終わっても全員の場札はそのまま残り、次のラウンドが始まるときに捨て札へ送られます。</p>
        <p>山札が尽きたら捨て札を切り直して山札に戻します。山札も捨て札も尽きた場合、引こうとした人は自動的に「降りる」扱いになります。</p>
        <p>
          <b className="text-cream/95">目標点モード</b>… 誰かが目標点（100 / 200 / 300）に届いたラウンドの終了時にゲーム終了。
          <br />
          <b className="text-cream/95">ラウンド数モード</b>… 決めたラウンド数（3 / 5 / 10）を終えた時点でゲーム終了。
          <br />
          どちらも最高点の人が勝ちで、同点は同順位です。
        </p>
      </Section>

      <Section title="制限時間" lead="20秒 / 1分 / 無制限（ホストが設定）。">
        <p>手番の残り時間はヘッダーのリングで確認できます。時間切れになると、自動的に「降りる」が選ばれます。</p>
        <p>氷結・三連・保険の譲渡で対象を選んでいる途中に時間切れになった場合は、自分（保険の譲渡は最初の該当者）が対象になります。</p>
        <p>CPU には制限時間は適用されません。</p>
      </Section>

      <Section title="CPU対戦" lead="人が集まらなくても遊べます。">
        <p>
          ロビーでホストが「＋ CPU を追加」を押すと、CPU が1体ずつ席に着きます。人間と CPU を合わせて最大12人、2人からゲームを始められます。
        </p>
        <p>CPU の手番は約1.5秒後に自動で進みます。残りの山札からバーストする確率を見積もって、引くか降りるかを判断します。</p>
      </Section>

      <Section title="観戦と再接続">
        <p>ゲームの途中で入ってきた人や、席が満員のときの参加者は<b className="text-cream/95">観戦</b>になります。次のゲームから席に着けます。</p>
        <p>
          通信が切れたりアプリを閉じたりしても、
          <b className="text-cream/95">
            {isNative() ? '同じルームコードで入り直せば元の席に戻れます' : '同じURL（またはルームコード）をもう一度開けば元の席に戻れます'}
          </b>
          。ホームに戻っても席は残ります。
        </p>
        <p>
          ホストが戻ってこなくなっても大丈夫です。卓が<b className="text-cream/95">30秒以上進んでいなければ、着席している人なら誰でも</b>「次のラウンドへ」「もう一度」を押して進められます。
        </p>
      </Section>

      <Section title="ヒント">
        <p>・場の数字が4〜5枚を超えたあたりから、バーストの危険は急に上がります。点が伸びたところで降りるのも立派な勝ち方です。</p>
        <p>・6種類そろったら、あと1種で +15点。ここは押しどころです。</p>
        <p>・氷結は、いちばん点を伸ばしている相手へ。自分が最高点なら、自分に使って確定させるのも有効です。</p>
        <p>・三連は場札の多い相手へ（バーストを狙えます）。逆に自分の場が2枚以下なら、自分に使って一気に伸ばす手もあります。</p>
        <p>・保険を持っている間は、少しだけ強気に引けます。使いどころを逃さないように。</p>
      </Section>
    </div>
  );
}

/* ---------- 全画面シート ---------- */

/**
 * 「遊び方」を全画面シートで表示する。
 * ルーム内から開いても部屋を離れないよう、ページ遷移ではなく重ねて出す。
 * `#/help` のページからも同じ見た目で使い回す。
 */
export default function HelpSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="遊び方"
      className="animate-sheetUp fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ink/97 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-lg">
        <header
          className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/8 bg-ink/95 px-4 pb-3 backdrop-blur"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            遊び方<span className="ml-2 text-[11px] font-extrabold tracking-[0.3em] text-gold/60">HOW TO PLAY</span>
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex min-h-[40px] shrink-0 items-center rounded-full border border-white/12 bg-white/5 px-4 text-[13px] font-bold leading-none text-cream/85 transition active:scale-95"
          >
            閉じる
          </button>
        </header>

        <div className="px-4 pt-4" style={{ paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))' }}>
          <HelpContent />
        </div>
      </div>
    </div>
  );
}
