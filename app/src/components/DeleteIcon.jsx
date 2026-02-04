import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './DeleteIcon.css';

export default function DeleteIcon() {
  const { appState, resetApp, cancelProcessing } = useApp();
  const { t } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);

  // Show when: uploaded, ready, or processing
  // Hide when: idle or completed
  const shouldShow = ['uploading', 'ready', 'processing'].includes(appState);
  const isProcessing = appState === 'processing';

  if (!shouldShow) {
    return null;
  }

  const handleAction = () => {
    setShowConfirm(false);
    if (isProcessing) {
      cancelProcessing();
    } else {
      resetApp();
    }
  };

  // Processing: show X icon for cancel
  // Others: show trash icon for delete
  const IconComponent = isProcessing ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );

  const confirmMessage = isProcessing
    ? t('confirmCancel') || 'Cancel processing?'
    : t('confirmDelete');

  const actionLabel = isProcessing ? t('cancel') : t('delete');

  return (
    <>
      <button
        className={`delete-icon ${isProcessing ? 'cancel-mode' : ''}`}
        onClick={() => setShowConfirm(true)}
        title={isProcessing ? t('cancel') : t('delete')}
      >
        {IconComponent}
      </button>

      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p className="confirm-message">{confirmMessage}</p>
            <div className="confirm-buttons">
              <button
                className="confirm-button cancel"
                onClick={() => setShowConfirm(false)}
              >
                {t('cancel')}
              </button>
              <button
                className="confirm-button delete"
                onClick={handleAction}
              >
                {actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
