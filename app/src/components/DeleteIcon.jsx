import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './DeleteIcon.css';

export default function DeleteIcon() {
  const { appState, resetApp } = useApp();
  const { t } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);

  // Show when: uploaded, ready, or processing
  // Hide when: idle or completed
  const shouldShow = ['uploading', 'ready', 'processing'].includes(appState);

  if (!shouldShow) {
    return null;
  }

  const handleDelete = () => {
    setShowConfirm(false);
    resetApp();
  };

  return (
    <>
      <button
        className="delete-icon"
        onClick={() => setShowConfirm(true)}
        title={t('delete')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>

      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p className="confirm-message">{t('confirmDelete')}</p>
            <div className="confirm-buttons">
              <button
                className="confirm-button cancel"
                onClick={() => setShowConfirm(false)}
              >
                {t('cancel')}
              </button>
              <button
                className="confirm-button delete"
                onClick={handleDelete}
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
