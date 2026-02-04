import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './DownloadButton.css';

export default function DownloadButton() {
  const { appState, outputVideoUrl } = useApp();
  const { t } = useLanguage();

  // Only show after completion
  if (appState !== 'completed' || !outputVideoUrl) {
    return null;
  }

  const handleDownload = () => {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .slice(0, 15);
    const filename = `LOOPIA_${timestamp}.mp4`;

    const link = document.createElement('a');
    link.href = outputVideoUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button className="download-button" onClick={handleDownload}>
      <span className="download-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </span>
      <span>{t('download')}</span>
    </button>
  );
}
