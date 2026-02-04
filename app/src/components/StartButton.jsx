import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './StartButton.css';

export default function StartButton() {
  const { appState, startProcessing } = useApp();
  const { t } = useLanguage();

  const isDisabled = appState !== 'ready';
  const isProcessing = appState === 'processing';
  const isCompleted = appState === 'completed';

  // Hide button after completion
  if (isCompleted) {
    return null;
  }

  const getButtonText = () => {
    if (isProcessing) {
      return t('processing');
    }
    return t('startLoop');
  };

  return (
    <button
      className={`start-button ${isProcessing ? 'processing' : ''}`}
      onClick={startProcessing}
      disabled={isDisabled}
    >
      {getButtonText()}
    </button>
  );
}
