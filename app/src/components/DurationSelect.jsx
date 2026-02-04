import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './DurationSelect.css';

const DURATION_OPTIONS = [5, 10, 30, 60];

export default function DurationSelect() {
  const { appState, duration, setDuration } = useApp();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const isDisabled = appState === 'idle' || appState === 'uploading' || appState === 'processing';

  const handleSelect = (value) => {
    setDuration(value);
    setIsOpen(false);
  };

  return (
    <div className="duration-select-container">
      <div className="duration-label">
        <span className="duration-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>
        <span>{t('duration')}</span>
        <span className="chevron">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      <button
        className={`duration-button ${isDisabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
      >
        <span className="duration-value">{duration} {t('min')}</span>
        <span className="chevron-right">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>

      {isOpen && !isDisabled && (
        <div className="duration-dropdown">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option}
              className={`duration-option ${option === duration ? 'selected' : ''}`}
              onClick={() => handleSelect(option)}
            >
              {option} {t('min')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
