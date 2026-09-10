# App Store 提出用メタデータ・審査メモ

対象アプリ: **ラッキーセブン**（iPhone 版・Web アプリの Capacitor ラップ）
バンドル ID: `com.yoshitetsu.luckyseven`
バージョン: 1.0.0 / iPhone 専用・縦向き固定 / 最小 iOS 15
主要言語: 日本語（プライマリ）、英語（セカンダリ・メタデータのみ）

> **重要な法的フレーミング**: 本ゲームはプレス・ユア・ラック（引くか降りるか）型カードゲームというジャンルに属するが、名称・カード名（氷結／三連／保険）・アート・テキストはすべてオリジナル。ストア掲載物（名前・サブタイトル・説明文・キーワード・スクリーンショット文言・審査メモを含む）のどこにも、類似する既存の市販カードゲームやその発行元を示唆する語（"Flip"「フリップ」"Flip 7"「The Op」等）を一切含めないこと。以下のテキストはすべてこの方針に沿って作成済み。

---

## 1. アプリ情報

### アプリ名（30文字以内・商標衝突回避のため一般名詞を含める）

| # | 候補 | 文字数目安 |
|---|---|---|
| 1 | ラッキーセブン - 友達とカード | 約16字 |
| 2 | ラッキーセブン - みんなでカードゲーム | 約20字 |
| 3 | ラッキーセブン - オンライン対戦カード | 約19字 |

第一候補は「ラッキーセブン - 友達とカード」。「友達とカード」という一般名詞句が入っており、単独の固有名詞のみの名前より商標審査上のリスクが低い。

### サブタイトル（30文字以内）

| # | 候補 | 文字数目安 |
|---|---|---|
| 1 | 友達と遊ぶ、引くか降りるかの駆け引き | 約18字 |
| 2 | 6桁コードで友達とすぐ対戦 | 約13字 |
| 3 | CPUとも対戦できる爽快カードゲーム | 約17字 |

第一候補「友達と遊ぶ、引くか降りるかの駆け引き」を推奨。ジャンルを説明的に表現しつつ第三者ゲーム名を出さない。

### カテゴリ

- プライマリカテゴリ: **Games**
- サブカテゴリ: **Card**（セカンダリカテゴリは設定不要、必要なら Family でも可）

### 年齢制限（App Store Connect 年齢レーティング質問への回答）

すべて「なし（None）」を選択する。

| 質問項目 | 回答 |
|---|---|
| 暴力表現（カートゥーン/ファンタジー/リアル） | なし |
| 成人向け・性的表現 | なし |
| 下品な表現・ユーモア | なし |
| ホラー・恐怖表現 | なし |
| 薬物・アルコール・タバコの使用や言及 | なし |
| 賭博および賭博的な内容のシミュレーション | **なし**（得点はゲーム内スコアのみ、賭け金・換金要素は一切なし） |
| 現実のギャンブル（Unrestricted Web Access 等） | なし |
| 医療・治療に関する情報 | なし |
| ユーザー生成コンテンツ（無制限のWeb/チャット） | なし（チャット機能なし、ニックネームのみ） |
| コンテスト | なし |

→ 結果として **年齢レーティング 4+**。

### 著作権表記

```
© 2026 Yoshitetsu Suzuki
```

（日本語表記が必要な欄がある場合は「© 2026 鈴木嘉哲」）

### SKU 案

```
LUCKYSEVEN-IOS-100
```

（例: `luckyseven-ios-1.0.0` でも可。App Store Connect 内部管理用のため一度決めたら変更しない）

---

## 2. 説明文・キーワード等

### 説明文（日本語・4000字以内、実際は600〜900字程度）

```
離れた友達と、スマホだけで盛り上がれるオンラインカードゲーム。

ルールはシンプル。自分の番が来たら「引く」か「降りる」かを選ぶだけ。
引き続ければ得点は伸びていくけれど、同じ数字を2枚引いてしまったらその
ラウンドは0点に逆戻り。攻めるか、守るか——駆け引きが最高に熱いプレス・
ユア・ラック型カードゲームです。

■ 特徴
・6桁のルームコードを友達に送るだけで即参加。アカウント登録は不要、
　ニックネームを入れればすぐ遊べます。
・最大12人まで同時参加。人数が足りなければCPU（コンピューター）を
　追加してすぐに卓が埋まります。
・「氷結」「三連」「保険」などオリジナルのアクションカードが場をかき
　乱す。読み合いと運のバランスが絶妙です。
・数字カードが7種類そろうと大ボーナス、ラウンドは即終了。全員が固唾を
　のんで見守る瞬間です。
・カードが飛んでめくれる演出や効果音つきで、画面越しでも盛り上がれます。
・広告なし、課金なし、位置情報や行動のトラッキングも一切なし。

通話機能はついていないので、LINEやDiscordの通話をつなぎながら遊ぶのが
おすすめです。友達との週末や、離れて暮らす家族との時間に、ぜひ。
```

（実測はおよそ700字前後。App Store Connect の4000字上限には十分収まる）

### 英語説明文（English Description）

```
A press-your-luck card game you can play online with friends, right
from your phone.

The rule is simple: on your turn, choose to "hit" for another card or
"stay" and lock in your score. Keep hitting and your score climbs — but
draw a second copy of a number you already have, and your round score
drops to zero. Push your luck or play it safe: that's the whole game.

FEATURES
- Instant rooms: share a 6-digit code with friends and jump in. No
  account required — just pick a nickname.
- Up to 12 players at once. Not enough people? Add CPU opponents to
  fill the table.
- Original action cards — Freeze, Triple, and Insurance — keep every
  round unpredictable.
- Collect seven different number cards and trigger a big bonus that
  ends the round instantly for everyone.
- Cards fly across the table and flip with sound effects for a lively,
  tabletop feel even over video chat.
- No ads, no in-app purchases, no tracking.

There's no built-in voice chat, so we recommend playing alongside a
call on LINE, Discord, or FaceTime. Perfect for a weekend with friends
or catching up with family far away.
```

### プロモーションテキスト（170字以内・随時更新可能な欄）

```
6桁コードで友達とすぐ対戦できるオンラインカードゲーム。引くか降りるか
の駆け引きがクセになる。最大12人、CPUも参加OK。広告なし・課金なし・
アカウント登録不要ですぐ遊べます。
```

（文字数目安: 約100字。170字の上限に余裕あり）

### キーワード（100文字以内、カンマ区切り。日本語＋英語混在の最適案）

```
カードゲーム,友達,オンライン対戦,パーティーゲーム,CPU対戦,ルームコード,card game,party game,multiplayer,friends
```

※ アプリ名・サブタイトルに含まれる語（ラッキーセブン等）はキーワード欄に重複させず、そこで浮いた文字数を上記の語に充てている。「flip」「フリップ」等は含めない。

### 最新情報（What's New）for 1.0.0

```
ラッキーセブン、初回リリースです。
友達と6桁コードでルームを作って、最大12人でオンライン対戦できます。
人数が足りない時はCPUを追加してどうぞ。広告・課金・アカウント登録は
一切なし。まずは友達を誘って一卓囲んでみてください。
```

---

## 3. スクリーンショット計画

### 必須サイズ

- **6.9インチ（iPhone 16 Pro Max 等）**: 1320 × 2868 px
- **6.5インチ（iPhone 11 Pro Max / XS Max 等）**: 1284 × 2778 px または 1242 × 2688 px

いずれも縦向き（Portrait）。App Store Connect は 6.9インチ用があれば 6.5インチ用を自動生成する場合があるが、確実性のため両サイズを手動で用意する。

### 撮影する5枚と一言キャッチコピー案

| # | 画面 | キャッチコピー案 |
|---|---|---|
| 1 | ホーム画面（ニックネーム入力・ルーム作成/参加） | 「ニックネームだけで、今すぐ参加」 |
| 2 | ロビー画面（参加者一覧・CPU追加） | 「6桁コードを送るだけ。人数が足りなければCPUも」 |
| 3 | 卓画面・カードが飛んでめくれる演出の瞬間 | 「引くか、降りるか。駆け引きがアツい」 |
| 4 | 氷結カードの対象選択モーダル | 「氷結・三連・保険——一手が場をひっくり返す」 |
| 5 | 結果画面（最終順位） | 「盛り上がった一卓、最後は順位発表」 |

### 撮影手順

1. Xcode で iOS シミュレータ（撮影サイズに対応する機種、例: iPhone 16 Pro Max / iPhone 11 Pro Max）を起動する。
2. `npm run ios:sync` でビルドを最新化し、Xcode からシミュレータへ実行する。
3. 各シーンを画面上で再現する（2枚目以降はロビー/対戦を複数ウィンドウやCPU対戦で作り込む）。
4. ターミナルでスクリーンショットを撮る。

   ```bash
   xcrun simctl io booted screenshot ~/Desktop/shot-01-home.png
   xcrun simctl io booted screenshot ~/Desktop/shot-02-lobby.png
   xcrun simctl io booted screenshot ~/Desktop/shot-03-flip.png
   xcrun simctl io booted screenshot ~/Desktop/shot-04-freeze.png
   xcrun simctl io booted screenshot ~/Desktop/shot-05-result.png
   ```

5. シミュレータの解像度が目的の px サイズと一致するか確認し、異なる場合は `sips` 等でリサイズ、またはターゲット機種のシミュレータで撮り直す。
6. 必要ならキャッチコピーのテキストをオーバーレイする（Keynote / Figma 等で軽く載せる程度に留め、ゲーム画面の実態と乖離しないこと）。

---

## 4. App Privacy（アプリのプライバシー）回答

App Store Connect の「App Privacy」セクションで、以下の通り選択する。

### データ収集の有無

**「はい、このアプリはデータを収集します」** を選択（ニックネームを収集するため）。

### 収集するデータの種類

| カテゴリ | 選択する項目 | 理由 |
|---|---|---|
| ユーザーコンテンツ（User Content） | **その他のユーザーコンテンツ（Other User Content）** にチェックし、名称欄に「ニックネーム」を記載 | ルーム参加時に入力するニックネームのみを保持。プロフィール等は存在しない |
| 識別子（Identifiers） | **選択しない（なし）** | User ID・Device ID 等は収集していない（再接続用トークンは端末の localStorage に保存されサーバーへ個人特定情報として紐付かないため「識別子」に該当しない） |
| 診断（Diagnostics） | **選択しない（なし）** | クラッシュログ・パフォーマンスデータ等の収集は行っていない |
| 位置情報・連絡先・閲覧履歴・購入履歴・トラッキングデータ 等その他全カテゴリ | **選択しない（なし）** | 該当データを一切収集していない |

### 収集した「ニックネーム」に対する詳細設定

各データ項目ごとの詳細設問で、以下の通りチェックする。

- **このデータの用途**: 「アプリの機能（App Functionality）」のみにチェック（他の用途＝分析・広告・製品パーソナライズ等はすべて未選択）。
- **このデータはユーザーに関連付けられますか（Linked to the User）**: **いいえ（Not Linked to the User）** を選択。ニックネームはルーム内でのみ使われ、氏名・メール等の個人識別情報とは結びつかない。
- **このデータはトラッキングに使用されますか（Used for Tracking）**: **いいえ**。

### トラッキングに関する設問

「App Tracking Transparency（ATT）のトラッキング許可を求めるか」の設問には **いいえ** と回答する。本アプリはユーザーや端末を他社アプリ・Webサイトを横断して追跡しない。

---

## 5. 審査メモ（App Review Notes）

App Store Connect の「App Review Information」→「Notes」欄に、以下（日本語版が通らない場合は英訳して）貼り付ける。

```
■ テスト方法（2台目の端末やアカウントは不要です）
1. アプリを起動し、ニックネームを入力して「ルームを作る」をタップします。
2. ロビー画面で「CPUを追加」を2〜3体分タップします（最低2人でゲーム
   開始可能です）。
3. 「開始」をタップするとゲームが始まります。自分の番になったら「引く」
   「降りる」で進行します。CPUは自動で手番を進めます。
   以上の手順だけで、他の実機・他アカウントなしにゲームの主要な流れ
  （配布・引く/降りる・アクションカード・得点計算・結果画面）を一通り
   確認いただけます。

■ ログイン・アカウントについて
アカウント登録や認証は一切ありません。ニックネームの入力のみで利用でき
ます。

■ ネットワークについて
本アプリはオンライン専用です（Supabaseのリアルタイム通信を利用したマル
チプレイヤー機能のため）。テスト時はWi-Fiまたはモバイル通信が有効な環境
でお試しください。

■ データの取り扱い
ルームの参加者情報（ニックネーム・場札等）はルームごとにサーバーへ一時
保存され、ルームは作成から24時間で自動的に削除されます。ユーザーの戦績
や個人情報を継続的に保存する仕組みはありません。

■ 連絡先
不明点があれば下記サポートメールまでご連絡ください。
yoshitetsugames21+lucky7@gmail.com
```

### 補足パラグラフ（隠しコマンド「ラッキーモード」を審査ビルドに含める場合）

ガイドライン 2.3.1（隠し機能の不開示）に抵触しないよう、ビルドに隠し要素を含めたまま提出する場合は、上記メモの末尾に以下を追記する。

```
■ 隠し要素の開示（Guideline 2.3.1 対応）
本ビルドには、対戦卓の画面で自分のニックネームを3秒間長押しすると切り
替わる「ラッキーモード」という隠し要素が含まれています。見た目の変化は
タイトル文字のわずかな明度変化のみで、ゲームバランスに影響する演出上の
Easter Egg（遊び心の要素）であり、不正なチート機能や外部リンク、審査回
避を目的としたものではありません。動作確認方法: 対戦卓画面で自分の名前
表示部分を3秒間長押ししてください。
```

このビルドで `VITE_ENABLE_LUCKY=0` を設定して当該機能を無効化して提出する場合は、上記補足パラグラフの代わりに次の一行のみで足りる。

```
本ビルドでは隠し要素（ラッキーモード）は無効化されています（ビルドフラ
グ VITE_ENABLE_LUCKY=0）。
```

---

## 6. 輸出コンプライアンス（Export Compliance）

App Store Connect の提出時に表示される暗号化に関する質問には、以下の通り回答する。

- **質問**: 「このアプリは暗号化を使用していますか？」→ **はい**（HTTPS通信を使用するため）
- **質問**: 「独自の暗号化アルゴリズムを実装・使用していますか？」→ **いいえ**
- **質問**: 「アプリが使用する暗号化は、標準的な暗号化（HTTPS/TLS等、OS標準API経由）に限られますか？」→ **はい**

→ 結果として `ITSAppUsesNonExemptEncryption` は **`false`** となる（Info.plist / App Store Connect の輸出コンプライアンス欄に反映）。

**根拠**: 本アプリが行う通信は、Supabase（Postgres REST / Realtime / Edge Functions）に対する標準的な **HTTPS（TLS）** のみであり、それ以外の独自暗号化ロジック・カスタム暗号方式は実装していない。OS標準のTLSスタックのみを利用しているため、米国輸出規制上の「非適用（exempt）」に該当し、年次自己分類報告（Annual Self Classification Report）等の追加手続きは不要。

`Info.plist` に以下を設定しておく（未設定の場合は追加する）。

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

---

## 7. 提出前チェックリスト

- [ ] **署名**: Xcode の Signing & Capabilities で正しい Team / Provisioning Profile（Distribution）が設定されている
- [ ] **バージョン/ビルド番号**: `CFBundleShortVersionString` = `1.0.0`、`CFBundleVersion`（ビルド番号）を前回提出から必ずインクリメントしている
- [ ] **アイコン**: 1024×1024 のマーケティング用アイコン（透過なし・角丸なし）を App Store Connect にアップロード済み。Xcode 内アイコンセットも全サイズ揃っている
- [ ] **スクリーンショット**: 6.9インチ・6.5インチとも5枚ずつアップロード済み、内容が実際のアプリ画面と一致している
- [ ] **URL**: Webサイト・プライバシーポリシー・サポートURL・利用規約URLがすべて実際にブラウザで開いて表示できることを確認済み
  - サイト: `https://yoshitetsusuzuki.github.io/lucky-seven/`
  - プライバシーポリシー: `https://yoshitetsusuzuki.github.io/lucky-seven/legal/privacy.html`
  - サポート: `https://yoshitetsusuzuki.github.io/lucky-seven/legal/support.html`
  - 利用規約: `https://yoshitetsusuzuki.github.io/lucky-seven/legal/terms.html`
- [ ] **年齢制限**: 全質問「なし」で回答し4+になっていることを確認
- [ ] **プライバシー（App Privacy）**: 本ドキュメント4章の通り「ユーザーコンテンツ（ニックネーム）／アプリの機能／紐付けなし／トラッキングなし」で登録済み
- [ ] **審査メモ**: 本ドキュメント5章のテスト手順・連絡先を App Review Information に貼付済み
- [ ] **TestFlight で実機確認**: 実機（シミュレータではない）にTestFlightからインストールし、ルーム作成→CPU追加→対戦→結果表示までひと通り動作することを確認
- [ ] **サポートメールの受信テスト**: `yoshitetsugames21+lucky7@gmail.com` 宛にテストメールを送り、正しく受信箱（または+タグでのフィルタ先）に届くことを確認

---

## 8. ローンチ後

### 友人への配布方法

- **通常配布（審査通過後）**: App Store の公開リンク（例: `https://apps.apple.com/app/idXXXXXXXXXX`）をLINE等で友達に送るだけでインストールできる。非公開設定は不要（友人限定で使わせたい場合も、ルームコード制のため知らない人が入ってくる心配はない）。
- **審査前・少人数向け（TestFlight）**: App Store Connect の TestFlight で内部/外部テスターとしてメールアドレスを招待するか、パブリックリンクを発行して共有する。外部テスターを使う場合は簡易的な審査（Beta App Review）が入る点に留意。

### 更新時の手順

1. `apps/web` 側でゲーム内容・UI等を変更し、`npm test`（エンジンのテスト）を通す
2. `npm run ios:sync` を実行（`build:native` でWebをビルドし、`cap sync ios` でネイティブプロジェクトへ反映）
3. Xcode でプロジェクトを開き（`npm run ios:open`）、`CFBundleVersion`（ビルド番号）を必ずインクリメント。ユーザー影響のある変更であれば `CFBundleShortVersionString`（バージョン番号）も更新
4. Xcode で Archive を作成し、Organizer から App Store Connect へアップロード
5. App Store Connect 側で新しいビルドを選択し、必要であれば「最新情報（What's New）」を更新して提出

---

以上でございます。ご確認くださいませ。
