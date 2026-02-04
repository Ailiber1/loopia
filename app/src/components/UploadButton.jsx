import { useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './UploadButton.css';

const ACCEPTED_FORMATS = '.mp4,.mov,.avi,.webm';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function UploadButton() {
  const inputRef = useRef(null);
  const { appState, uploadVideo, setErrorState } = useApp();
  const { t } = useLanguage();

  const isDisabled = appState === 'uploading' || appState === 'processing';

  const handleClick = () => {
    if (!isDisabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setErrorState('unsupportedFormat');
      e.target.value = '';
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setErrorState('fileTooLarge');
      e.target.value = '';
      return;
    }

    uploadVideo(file);
    e.target.value = '';
  };

  const getButtonText = () => {
    if (appState === 'uploading') {
      return t('uploading');
    }
    return t('upload');
  };

  return (
    <div className="upload-button-container">
      <button
        className="upload-button"
        onClick={handleClick}
        disabled={isDisabled}
      >
        <span className="upload-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>
        <span className="upload-text">{getButtonText()}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
