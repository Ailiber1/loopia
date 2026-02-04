import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './ErrorDisplay.css';

export default function ErrorDisplay() {
  const { appState, error, retryFromError, resetApp } = useApp();
  const { t } = useLanguage();

  if (appState !== 'error' || !error) {
    return null;
  }

  return (
    <div className="error-overlay">
      <div className="error-content">
        <div className="error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <p className="error-message">{t(error)}</p>

        <div className="error-buttons">
          <button className="error-button retry" onClick={retryFromError}>
            {t('retry')}
          </button>
          <button className="error-button cancel" onClick={resetApp}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
