import { createContext, useContext, useState, useCallback } from 'react';

const translations = {
  ja: {
    upload: 'Upload',
    uploading: 'アップロード中...',
    duration: 'Duration',
    startLoop: 'Start Loop',
    processing: '生成中…',
    download: 'Download',
    delete: '削除',
    cancel: 'キャンセル',
    confirmCancel: '処理を中止しますか？',
    confirmDelete: '現在の作業を破棄しますか？',
    analyzingVideo: '動画解析中...',
    interpolatingSeams: '繋ぎ目補間中...',
    generatingLoop: 'ループ生成中...',
    finalizing: '最終処理中...',
    complete: '完了',
    generatingSeamlessLoop: 'Generating seamless loop...',
    estimatedTime: '推定残り時間',
    aboutMinutes: '約{min}分',
    unsupportedFormat: '対応していない形式です',
    fileTooLarge: 'ファイルサイズが大きすぎます（上限100MB）',
    videoTooShort: '動画が短すぎます（最低3秒）',
    uploadFailed: 'アップロードに失敗しました',
    processingTimeout: '処理がタイムアウトしました',
    temporaryError: '一時的なエラーが発生しました',
    retry: '再試行',
    checkSeams: '繋ぎ目確認',
    min: '分',
  },
  en: {
    upload: 'Upload',
    uploading: 'Uploading...',
    duration: 'Duration',
    startLoop: 'Start Loop',
    processing: 'Processing…',
    download: 'Download',
    delete: 'Delete',
    cancel: 'Cancel',
    confirmCancel: 'Cancel processing?',
    confirmDelete: 'Discard current work?',
    analyzingVideo: 'Analyzing video...',
    interpolatingSeams: 'Interpolating seams...',
    generatingLoop: 'Generating loop...',
    finalizing: 'Finalizing...',
    complete: 'Complete',
    generatingSeamlessLoop: 'Generating seamless loop...',
    estimatedTime: 'Estimated',
    aboutMinutes: 'About {min} min',
    unsupportedFormat: 'Unsupported format',
    fileTooLarge: 'File too large (max 100MB)',
    videoTooShort: 'Video too short (min 3s)',
    uploadFailed: 'Upload failed',
    processingTimeout: 'Processing timeout',
    temporaryError: 'Temporary error occurred',
    retry: 'Retry',
    checkSeams: 'Check seams',
    min: 'min',
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('ja');

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'ja' ? 'en' : 'ja'));
  }, []);

  const t = useCallback(
    (key, params = {}) => {
      let text = translations[language][key] || key;
      Object.entries(params).forEach(([param, value]) => {
        text = text.replace(`{${param}}`, value);
      });
      return text;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
