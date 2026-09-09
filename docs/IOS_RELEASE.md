# iOS リリース手順（ラッキーセブン）

Capacitor で Web アプリ（`apps/web`）をネイティブ iOS アプリとして包み、App Store に提出するための手順書。

| 項目 | 値 |
| --- | --- |
| Bundle ID | `com.yoshitetsu.luckyseven` |
| 表示名 | ラッキーセブン |
| Apple Team ID | `2ZS2R958MK` |
| 対応デバイス | iPhone のみ（`TARGETED_DEVICE_FAMILY = 1`） |
| 最低 iOS | 15.0 |
| 画面向き | 縦のみ |
| Capacitor | 8.x（依存は CocoaPods ではなく **Swift Package Manager**） |

---

## 0. 前提

- Xcode（26.6 で動作確認済み）
- Node.js 20 以上
- `apps/web/.env.local` に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` が入っていること
  （Vite は `apps/web/` 直下の `.env.local` を読むので、ルートに置いても効きません）
- **リポジトリのパスに日本語が含まれる**ため、ターミナルでは必ず先に実行しておくこと:

  ```sh
  export LANG=en_US.UTF-8
  ```

---

## 1. 日常の開発フロー

Web 側（`apps/web/src` など）を触ったら、**必ず同期してからビルド**する。
`ios/App/App/public/` は同期で毎回上書きされる生成物なので、直接編集しない（Git 管理外）。

```sh
export LANG=en_US.UTF-8
npm run ios:sync     # Web を base=/ でビルド → ios/ へコピー → プラグイン同期
npm run ios:open     # Xcode で ios/App/App.xcodeproj を開く
```

| スクリプト | 中身 |
| --- | --- |
| `npm run build:native` | `VITE_BASE=/ npm run build -w @lucky7/web`（ネイティブは必ず base `/`） |
| `npm run ios:sync` | `build:native` → `npx cap sync ios` |
| `npm run ios:open` | `npx cap open ios` |

> GitHub Pages 版は `VITE_BASE=/フリップセブンアプリ/` のようなサブパスでビルドするが、
> ネイティブは `capacitor://localhost` 直下配信なので **base は `/` でなければ真っ白になる**。

### シミュレータで確認する

```sh
export LANG=en_US.UTF-8
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' \
  -derivedDataPath build/DerivedData build CODE_SIGNING_ALLOWED=NO

xcrun simctl install booted build/DerivedData/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch  booted com.yoshitetsu.luckyseven
```

複数のシミュレータが起動していると `booted` が曖昧になるので、その場合は UDID を指定する
（`xcrun simctl list devices booted` で確認）。

---

## 2. バージョン番号のルール

Xcode の **App ターゲット → General**、または `ios/App/App.xcodeproj/project.pbxproj` の
`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` を直接編集する。

| 設定 | 意味 | 上げ方 |
| --- | --- | --- |
| `MARKETING_VERSION`（CFBundleShortVersionString） | ユーザーに見えるバージョン | 機能追加は `1.1.0`、バグ修正は `1.0.1` |
| `CURRENT_PROJECT_VERSION`（CFBundleVersion） | ビルド番号 | **App Store Connect に上げるたび必ず +1**（同じ番号は再アップロード不可） |

- TestFlight に上げ直すだけなら `CURRENT_PROJECT_VERSION` だけ +1 でよい。
- 審査に出す新バージョンは `MARKETING_VERSION` を上げ、`CURRENT_PROJECT_VERSION` を `1` に戻してもよい（単調増加である必要はバージョン単位）。

現在の値: `MARKETING_VERSION = 1.0.0` / `CURRENT_PROJECT_VERSION = 1`

---

## 3. アーカイブして App Store Connect へ提出

1. `export LANG=en_US.UTF-8 && npm run ios:sync`（Web の最新を取り込む）
2. `npm run ios:open` で Xcode を開く
3. 左の **App** ターゲット → **Signing & Capabilities**
   - *Automatically manage signing* にチェック
   - **Team** に `2ZS2R958MK`（Yoshitetsu Suzuki）を選択
   - Bundle Identifier が `com.yoshitetsu.luckyseven` であることを確認
   - 初回は App Store Connect 側で同じ Bundle ID のアプリレコードを作っておくこと
4. 上部のデバイス選択を **Any iOS Device (arm64)** に切り替える（シミュレータのままだと Archive できない）
5. メニュー **Product → Archive**
6. Organizer が開いたら **Distribute App → App Store Connect → Upload**
   - *Upload your app's symbols* はオン
   - *Manage Version and Build Number* はオフ推奨（自分で管理する）
7. アップロード完了後、App Store Connect の「TestFlight」タブで処理完了（10〜30 分）を待つ
8. 「App Store」タブで新バージョンを作り、スクリーンショット・説明文・審査メモを入れて **審査へ提出**

### 輸出コンプライアンス

`Info.plist` に `ITSAppUsesNonExemptEncryption = false` を設定済みなので、
提出のたびに暗号化について聞かれることはない（通信は HTTPS のみ）。

---

## 4. スクリーンショットの撮り方

App Store Connect に必須なのは **6.9 インチ** と **6.5 インチ** の 2 サイズ（iPhone のみのアプリの場合）。

| クラス | 使うシミュレータ | 解像度 |
| --- | --- | --- |
| 6.9"（必須） | iPhone 17 Pro Max | 1320 × 2868 |
| 6.5"（必須） | iPhone 11 Pro Max（このマシンでは `SS-11ProMax`） | 1242 × 2688 |
| 6.3"（任意・参考） | iPhone 17 | 1206 × 2622 |

```sh
export LANG=en_US.UTF-8

# 6.9"
xcrun simctl boot "iPhone 17 Pro Max"
xcrun simctl install "iPhone 17 Pro Max" build/DerivedData/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch  "iPhone 17 Pro Max" com.yoshitetsu.luckyseven
xcrun simctl io "iPhone 17 Pro Max" screenshot ~/Desktop/ss-6.9-01.png

# 6.5"
xcrun simctl boot "SS-11ProMax"
xcrun simctl install "SS-11ProMax" build/DerivedData/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch  "SS-11ProMax" com.yoshitetsu.luckyseven
xcrun simctl io "SS-11ProMax" screenshot ~/Desktop/ss-6.5-01.png
```

コツ:
- ステータスバーを綺麗に揃えるなら `xcrun simctl status_bar <device> override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4`
- 実際の対局画面を撮るには、シミュレータを 2 台起動して同じルームコードで参加させると 2 人卓が作れる。
- 撮った PNG に透明度は入らないのでそのままアップロードできる。

---

## 5. TestFlight で友人に配る

1. 上記の手順でビルドをアップロードし、TestFlight の処理完了を待つ
2. App Store Connect → **TestFlight** → 該当ビルド → 「輸出コンプライアンス」を回答（不要な設定済みなら自動で通る）
3. **内部テスター**（自分の Apple Account に紐づく最大 100 名・審査不要・即配布）
   - 「App Store Connect ユーザー」に追加した人のみ。身内数名ならこれが一番速い。
4. **外部テスター**（最大 10,000 名・メールアドレスだけで招待可・**初回のみ Beta App Review が必要**、通常 1 日程度）
   - TestFlight → 外部グループを作成 → テスターのメールを追加 → ビルドを割り当て → 提出
   - 「テスト情報」に、テスト範囲と連絡先メール（`yoshitetsugames21+lucky7@gmail.com`）を記入
5. テスターは TestFlight アプリ（App Store から無料）を入れて、届いた招待リンクを開くだけ

---

## 6. 審査で注意すべき点

### 6.1 隠し「ラッキー」モードとガイドライン 2.3.1

対局画面で自分の名前を 3 秒長押しすると `toggle_lucky` が呼ばれ、いわゆる「ツキ」モードが切り替わる隠し機能がある
（`apps/web/src/hooks/useLuckyToggle.ts` → Supabase Edge Function `act`）。

App Review Guideline **2.3.1（Accurate Metadata / 隠し機能の禁止）** は、
「審査員に知らされていない、隠された・文書化されていない機能」を明確に禁止している。
リリース前に **どちらかを必ず実施すること**:

- **推奨 A: ストア版では無効化する。**
  ビルドフラグ `VITE_ENABLE_LUCKY` が用意されている（`apps/web/src/lib/flags.ts`）。
  未指定または `1` で有効、`0` で完全に無効（長押ししても何も起きない）。ストア用ビルドは:

  ```sh
  export LANG=en_US.UTF-8
  VITE_ENABLE_LUCKY=0 npm run ios:sync
  ```

  で焼き、そのまま Xcode で Archive する。
  （※クライアント側を落とすだけなので、Supabase Edge Function 側の `toggle_lucky` も塞ぐとより安全）
- **B: 審査メモで開示する。**
  App Store Connect の「App Review に関する情報 → メモ」に、日本語＋英語で
  「自分の名前を長押しすると『ラッキーモード』がオン/オフになる隠しコマンドがあります。
  友人同士の遊びを盛り上げる演出で、課金・射幸性・外部通信とは無関係です」といった内容と、
  再現手順（ルーム作成 → 対局開始 → 自分の名前を 1 秒長押し）を明記する。

### 6.2 その他のチェック

- **賭博（4.7 / 5.3）**: 実際の金銭のやり取りは一切ないこと。説明文でも「賭け」を連想させる表現は避ける。
- **年齢レーティング**: 「頻度の低い/軽度な模擬ギャンブル」に該当する可能性があるため、質問票では正直に回答する。
- **サポート URL / プライバシーポリシー URL** は必須。共通の窓口メールは `yoshitetsugames21+lucky7@gmail.com`。
- **オンライン必須**: 審査員がネットワーク無しで起動した場合でもクラッシュせず、エラー表示が出ることを確認しておく。
- **アカウント不要**（ニックネームだけ）なので、デモアカウントの提出は不要。

---

## 7. 既知の TODO（Web 側担当）

`apps/web/src` はこのドキュメントの担当範囲外なので、以下は Web 側で対応してほしい項目。

1. **セーフエリア対応（要対応）。** シミュレータ実測で、ホーム画面右上の「BGM / 効果音」ボタンが
   ステータスバー（時計・電波・バッテリー）と重なっている。ヘッダーに
   `padding-top: env(safe-area-inset-top)` 相当（Tailwind なら `pt-[env(safe-area-inset-top)]`）を足すこと。
   `index.html` の `<meta name="viewport" ... viewport-fit=cover>` は設定済みなので、CSS 側だけで対応できる。
2. **今後、外部サイトへのリンクを足す場合は `@capacitor/browser` を使う。**
   `capacitor.config.ts` で `server.allowNavigation: []` にしてあるため、
   アプリ内 WebView が外部ドメインへ遷移することはない（`<a href="https://...">` を踏んでも何も起きない）。
   現状の利用規約・プライバシー・サポートは `apps/web/public/legal/*.html` の**同一オリジン**の静的ページなので
   そのまま開ける（`src/lib/links.ts` の `legalUrl()`）。`mailto:` も iOS 側で標準メールが開くため問題なし。
   将来、外部の URL を開く必要が出たら、ネイティブ時のみ
   `import { Browser } from '@capacitor/browser'; await Browser.open({ url })`
   （SFSafariViewController）に分岐すること。ガイドライン的にもアプリ内ブラウザ表示が正。
3. **バージョン表記の一致。** `VITE_APP_VERSION` を `MARKETING_VERSION` と揃えておくと、
   アプリ内「設定・情報」の表示と App Store のバージョンがずれない。

### 関連ドキュメント

- `docs/APP_STORE.md` — ストア掲載文言（アプリ名・説明文・キーワード・審査メモ）。提出時はこちらを参照。

---

## 8. 生成物・設定ファイルの場所

| パス | 説明 |
| --- | --- |
| `capacitor.config.ts` | Capacitor 設定（appId / webDir / スプラッシュ / ステータスバー） |
| `resources/icon.png` | アイコン原本 1024×1024（アルファ無し・角丸を焼き込まない） |
| `resources/splash.png` / `splash-dark.png` | スプラッシュ原本 2732×2732 |
| `resources/src/*.svg` | 上記 PNG の元 SVG。作り直す場合は `qlmanage -t -s 1024 -o . icon.svg` で書き出し、必ずアルファを落とす |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset` | 生成された App アイコン |
| `ios/App/App/Info.plist` | 表示名・向き・ローカライズ・暗号化申告 |
| `ios/App/App/public/` | 同期される Web ビルド成果物（**Git 管理外・直接編集禁止**） |

アイコン／スプラッシュを作り直したとき:

```sh
export LANG=en_US.UTF-8
npx @capacitor/assets generate --ios \
  --iconBackgroundColor '#0a0e1a' --splashBackgroundColor '#0a0e1a'
```

### 補足: `ios.scheme` について

`capacitor.config.ts` の `ios.scheme` には指示どおり `'ラッキーセブン'` を設定しているが、
WKWebView のカスタム URL スキームは ASCII のみ有効なため **この値は無視され、
実際のオリジンは `capacitor://localhost` になる**（シミュレータで確認済み・クラッシュはしない）。
オリジンを明示的に変えたい場合は `'luckyseven'` のような ASCII 文字列にすること。
なお、オリジンを変えると `localStorage` に保存されたニックネーム等が引き継がれない点に注意。
