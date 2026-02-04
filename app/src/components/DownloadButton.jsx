import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './DownloadButton.css';

export default function DownloadButton() {
  const { appState, outputVideoUrl } = useApp();
  const { t } = useLanguage();

  const isCompleted = appState === 'completed' && outputVideoUrl;
  const isMultipleParts = Array.isArray(outputVideoUrl);
  const partCount = isMultipleParts ? outputVideoUrl.length : 1;

  const handleDownload = async () => {
    if (!isCompleted) return;

    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .slice(0, 15);

    if (isMultipleParts) {
      // Download multiple parts with delay between each
      for (let i = 0; i < outputVideoUrl.length; i++) {
        const filename = `LOOPIA_${timestamp}_part${i + 1}.mp4`;
        const link = document.createElement('a');
        link.href = outputVideoUrl[i];
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Small delay between downloads to prevent browser blocking
        if (i < outputVideoUrl.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else {
      // Single file download (original behavior)
      const filename = `LOOPIA_${timestamp}.mp4`;
      const link = document.createElement('a');
      link.href = outputVideoUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <button
      className={`download-button ${!isCompleted ? 'disabled' : ''}`}
      onClick={handleDownload}
      disabled={!isCompleted}
    >
      <span className="download-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </span>
      <span>
        {t('download')}
        {isMultipleParts && ` (${partCount})`}
      </span>
    </button>
  );
}
