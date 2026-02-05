# LOOPIA - シームレスループ動画生成アプリ 仕様書

## 1. 概要

LOOPIAは、短い動画からシームレスにループする長時間動画を生成するWebアプリケーションです。ブラウザ上で完結し、サーバーへの動画アップロードは不要です。

### 主な機能
- 3〜30秒の動画から5分〜60分のループ動画を生成
- RIFE AI（ONNX）による高品質なフレーム補間
- 1080p/4K対応
- 日本語/英語対応
- プログレッシブWebアプリ（PWA）

---

## 2. 技術スタック

### フロントエンド
| 技術 | バージョン | 用途 |
|-----|----------|------|
| React | 19.2.0 | UIフレームワーク |
| Vite | 7.2.4 | ビルドツール |
| CSS | - | スタイリング（CSS Variables使用） |

### 動画処理
| 技術 | バージョン | 用途 |
|-----|----------|------|
| @ffmpeg/ffmpeg | 0.12.15 | FFmpeg WASM（動画処理） |
| @ffmpeg/util | 0.12.1 | FFmpegユーティリティ |
| onnxruntime-web | 1.23.2 | RIFE ONNXモデル実行 |

### その他
| 技術 | バージョン | 用途 |
|-----|----------|------|
| coi-serviceworker | 0.1.7 | SharedArrayBuffer有効化（GitHub Pages用） |

---

## 3. ディレクトリ構造

```
loopia/
├── app/
│   ├── public/
│   │   └── coi-serviceworker.js    # SharedArrayBuffer有効化
│   ├── src/
│   │   ├── components/             # UIコンポーネント
│   │   │   ├── DeleteIcon.jsx/css
│   │   │   ├── DownloadButton.jsx/css
│   │   │   ├── DurationSelect.jsx/css
│   │   │   ├── ErrorDisplay.jsx/css
│   │   │   ├── Guide.jsx/css       # ユーザーガイド
│   │   │   ├── LanguageToggle.jsx/css
│   │   │   ├── Preview.jsx/css
│   │   │   ├── ProgressBar.jsx/css
│   │   │   ├── StartButton.jsx/css
│   │   │   └── UploadButton.jsx/css
│   │   ├── contexts/               # React Context
│   │   │   ├── AppContext.jsx      # アプリ状態管理
│   │   │   └── LanguageContext.jsx # 多言語対応
│   │   ├── hooks/                  # カスタムフック
│   │   │   ├── useLanguage.js
│   │   │   ├── useVideoProcessing.js
│   │   │   └── useVideoUpload.js
│   │   ├── services/               # ビジネスロジック
│   │   │   ├── rifeOnnx.js         # RIFE AI補間
│   │   │   └── videoProcessor.js   # FFmpeg処理
│   │   ├── styles/
│   │   │   └── global.css          # グローバルスタイル
│   │   ├── App.jsx                 # メインコンポーネント
│   │   ├── App.css
│   │   ├── main.jsx                # エントリーポイント
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── LOOPIA_SPECIFICATION.md
```

---

## 4. アプリケーション状態

### AppContext で管理する状態

```javascript
const states = {
  appState: 'idle' | 'uploading' | 'ready' | 'processing' | 'completed' | 'error',
  videoFile: File | null,           // アップロードされた動画ファイル
  videoUrl: string | null,          // プレビュー用Blob URL
  outputVideoUrl: string | null,    // 生成された動画のBlob URL
  duration: 5 | 10 | 30 | 60,       // 目標再生時間（分）
  progress: 0-100,                  // 処理進捗
  progressStage: string,            // 処理ステージ
  videoLength: number,              // 元動画の長さ（秒）
  processingMode: string,           // 'rife' | 'crossfade'
  error: string | null,             // エラーメッセージキー
};
```

### 状態遷移

```
idle → uploading → ready → processing → completed
                     ↓           ↓
                   error ←───────┘
```

---

## 5. 動画処理フロー

### 5.1 処理モード

#### モード1: RIFE ONNX（優先）
AIフレーム補間による高品質なシームレスループ

```
1. 動画読み込み
2. 最終フレーム・最初フレーム抽出
3. RIFE ONNXで8フレーム補間（ブリッジ作成）
4. main_part.mp4 + bridge.mp4 → seamless_unit.mp4
5. -stream_loop でループ展開
6. 出力
```

#### モード2: Crossfade（フォールバック）
xfadeトランジションによるシームレスループ

```
1. 動画読み込み
2. xfadeフィルターでシームレスユニット作成
3. -stream_loop でループ展開
4. 出力
```

### 5.2 FFmpegコマンド詳細

#### ブリッジ動画作成（RIFE ONNX）
```bash
ffmpeg -framerate {fps} -i frame_%04d.png \
  -c:v libx264 [-crf 28] -preset fast -pix_fmt yuv420p \
  -y bridge.mp4
```
※ 60分の場合のみ `-crf 28` を追加

#### メイン動画トリミング
```bash
ffmpeg -i input.mp4 -t {mainEnd} \
  -c:v libx264 [-crf 28] -preset fast -an \
  -y main_part.mp4
```

#### シームレスユニット結合
```bash
ffmpeg -f concat -safe 0 -i concat_list.txt \
  -c copy -y seamless_unit.mp4
```

#### ループ展開（重要）
```bash
ffmpeg -stream_loop {loopCount} -i seamless_unit.mp4 \
  -t {targetSeconds} -c copy -y output.mp4
```

**ポイント**: `-stream_loop` + `-c copy` の組み合わせにより、再エンコードなしで高速にループ展開

### 5.3 60分対応の最適化

```
問題: 60分の動画を再エンコードするとフリーズ
解決: seamless_unit作成時に圧縮 → ループ展開は -c copy

処理フロー:
1. seamless_unit.mp4を CRF 28 で圧縮作成（短い動画なので高速）
2. -stream_loop + -c copy でループ展開（再エンコードなし）
3. 最終ファイル: 1080p、約1.2GB、処理時間約10秒
```

---

## 6. RIFE ONNX 補間

### モデル情報
- モデル: RIFE v4.6
- URL: `https://huggingface.co/nickmuchi/rife-onnx/resolve/main/rife_v4.6.onnx`
- サイズ: 約150MB
- キャッシュ: IndexedDB（初回ダウンロード後は再利用）

### 処理フロー
```javascript
1. モデルロード（キャッシュまたはダウンロード）
2. 最終フレーム抽出（video.currentTime = duration - 0.1）
3. 最初フレーム抽出（video.currentTime = 0）
4. 512px以下にリサイズ（メモリ効率）
5. 8回補間（中間フレーム生成）
6. 元サイズにアップスケール
7. PNG → bridge.mp4 変換
```

### 実行環境優先順位
```javascript
1. WebGPU（最速）
2. WebGL（次点）
3. WASM/CPU（フォールバック）
```

---

## 7. UIコンポーネント仕様

### 7.1 UploadButton
- ドラッグ&ドロップ対応
- クリックでファイル選択
- 対応形式: video/*

### 7.2 DurationSelect
- 選択肢: 5分、10分、30分、60分
- デフォルト: 60分

### 7.3 StartButton
- 状態: idle時「ループ開始」、processing時「生成中...」
- 処理中は無効化

### 7.4 DownloadButton
- 完了時のみ有効
- ファイル名: `LOOPIA_YYYYMMDD_HHMMSS.mp4`

### 7.5 Preview
- 動画プレビュー表示
- 再生/一時停止コントロール
- シークバー
- 完了後: シーム確認ボタン（繋ぎ目にジャンプ）

### 7.6 ProgressBar
- 画面下部に固定表示
- 処理ステージ表示
- 推定残り時間表示

### 7.7 Guide
- 「?」ボタンでモーダル表示
- 推奨素材仕様
- 解像度・再生時間ガイド
- ループしやすい素材のコツ

---

## 8. 多言語対応

### LanguageContext
```javascript
const translations = {
  ja: {
    upload: 'アップロード',
    duration: '再生時間',
    startLoop: 'ループ開始',
    processing: '生成中...',
    download: 'ダウンロード',
    // ... その他
  },
  en: {
    upload: 'Upload',
    duration: 'Duration',
    startLoop: 'Start Loop',
    processing: 'Processing...',
    download: 'Download',
    // ... その他
  }
};
```

### 言語切り替え
- ヘッダー右上のトグルボタン
- localStorage に保存（次回訪問時も維持）

---

## 9. スタイリング

### カラーパレット（CSS Variables）
```css
:root {
  --color-bg: #0a0a0a;
  --color-surface: #1a1a1a;
  --color-accent: #f97316;      /* オレンジ */
  --color-accent-hover: #fb923c;
  --color-text: #ffffff;
  --color-text-secondary: rgba(255, 255, 255, 0.7);
  --color-border: rgba(255, 255, 255, 0.1);
  --color-success: #22c55e;
  --color-error: #ef4444;
}
```

### レスポンシブブレークポイント
- 1024px: タブレット
- 768px: モバイル（レイアウト変更）
- 480px: 小型モバイル

---

## 10. デプロイ

### GitHub Pages
```bash
# ビルド
cd app
npm run build

# gh-pagesブランチにデプロイ
# distフォルダの内容をgh-pagesブランチにプッシュ
```

### vite.config.js
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/loopia/',  // リポジトリ名
  build: {
    outDir: 'dist'
  }
});
```

### SharedArrayBuffer対応
GitHub Pagesでは `coi-serviceworker` を使用してSharedArrayBufferを有効化

```html
<!-- index.html -->
<script src="coi-serviceworker.js"></script>
```

---

## 11. 制限事項と推奨値

### 推奨入力素材
| 項目 | 推奨値 |
|-----|-------|
| 動画の長さ | 3〜30秒 |
| ファイルサイズ | 100MB以下 |
| 形式 | MP4 |
| 解像度 | 1080p（4Kは30分以下推奨） |

### 出力制限
| 解像度 | 最大再生時間 | 出力サイズ目安 |
|-------|------------|--------------|
| 1080p | 60分 | 約1.2GB |
| 4K | 30分 | 約2.4GB |

### ブラウザ要件
- SharedArrayBuffer対応（Chrome, Firefox, Edge）
- WebGL 2.0以上
- 推奨: WebGPU対応ブラウザ

---

## 12. エラーハンドリング

### エラーコード
| コード | 説明 | 対処 |
|-------|------|------|
| sharedArrayBufferNotSupported | SharedArrayBuffer非対応 | 対応ブラウザを使用 |
| processingFailed | 処理失敗 | 再試行または短い動画で試す |
| uploadFailed | アップロード失敗 | ファイル形式を確認 |

---

## 13. パフォーマンス最適化

### 実装済み最適化
1. **-stream_loop**: concat demuxerより高速
2. **-c copy**: ループ展開時の再エンコード回避
3. **事前圧縮**: 60分の場合、短いseamless_unitを圧縮
4. **シングルトンFFmpeg**: インスタンス再利用
5. **RIFEモデルキャッシュ**: IndexedDBに保存

### 処理時間目安
| 再生時間 | 処理時間 |
|---------|---------|
| 5分 | 約3秒 |
| 30分 | 約8秒 |
| 60分 | 約10秒 |

---

## 14. 今後の拡張案

- [ ] 音声対応（現在は映像のみ）
- [ ] バッチ処理（複数動画の一括処理）
- [ ] カスタムブレンド時間設定
- [ ] 出力品質選択（CRF値）
- [ ] PWAオフライン対応

---

## 15. ライセンス

MIT License

---

## 付録A: package.json

```json
{
  "name": "loopia",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "homepage": "https://ailiber1.github.io/loopia/",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ffmpeg/ffmpeg": "^0.12.15",
    "@ffmpeg/util": "^0.12.1",
    "coi-serviceworker": "^0.1.7",
    "onnxruntime-web": "^1.23.2",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "vite": "^7.2.4"
  }
}
```

---

## 付録B: 主要コード抜粋

### videoProcessor.js - ループ展開処理

```javascript
// For 60min: compress during seamless_unit creation (short video = fast)
// Then use -c copy for loop expansion (no re-encoding of 60min video)
const compressionArgs = needsCompression
  ? ['-crf', '28']  // Compress to reduce final file size (~1.2GB for 60min)
  : [];

// Create seamless unit with compression (if needed)
await ffmpeg.exec([
  '-i', inputFileName,
  '-t', String(mainEnd),
  '-c:v', 'libx264',
  ...compressionArgs,
  '-preset', 'fast',
  '-an',
  '-y',
  'main_part.mp4'
]);

// Loop expansion - always use stream copy (fast)
await ffmpeg.exec([
  '-stream_loop', String(loopCount),
  '-i', 'seamless_unit.mp4',
  '-t', String(targetSeconds),
  '-c', 'copy',
  '-y',
  outputFileName
]);
```

---

*この仕様書に基づいて、同一のアプリケーションを再現することができます。*
