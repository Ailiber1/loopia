import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './ProgressBar.css';

export default function ProgressBar() {
  const { appState, progress, progressStage } = useApp();
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (appState === 'processing') {
      setIsVisible(true);
    } else if (appState === 'completed') {
      // Fade out after 2 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [appState]);

  if (!isVisible && appState !== 'processing') {
    return null;
  }

  const getEstimatedTime = () => {
    if (progress >= 90) return t('aboutMinutes', { min: '1' });
    if (progress >= 40) return t('aboutMinutes', { min: '2' });
    if (progress >= 10) return t('aboutMinutes', { min: '4' });
    return t('aboutMinutes', { min: '5' });
  };

  return (
    <div className={`progress-bar-container ${!isVisible ? 'fade-out' : ''}`}>
      <div className="progress-info">
        <span className="progress-text">{t('generatingSeamlessLoop')}</span>
        <span className="progress-stage">{progressStage && t(progressStage)}</span>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="progress-details">
        <span className="estimated-time">
          {t('estimatedTime')}: {getEstimatedTime()}
        </span>
        <span className="progress-percent">{progress}%</span>
      </div>
    </div>
  );
}
