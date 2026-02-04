import { useRef, useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Preview.css';

export default function Preview() {
  const videoRef = useRef(null);
  const { appState, videoUrl, outputVideoUrl, videoLength, setVideoLength, progress } = useApp();
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const isCompleted = appState === 'completed';
  const isProcessing = appState === 'processing';
  const displayUrl = isCompleted ? outputVideoUrl : videoUrl;
  const showVideo = displayUrl && ['ready', 'processing', 'completed'].includes(appState);

  useEffect(() => {
    if (videoRef.current && displayUrl) {
      const video = videoRef.current;

      const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
      };

      const handleLoadedMetadata = () => {
        setVideoDuration(video.duration);
        if (!isCompleted) {
          setVideoLength(video.duration);
        }
      };

      const handleEnded = () => {
        // Loop playback
        video.currentTime = 0;
        video.play();
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }
  }, [displayUrl, isCompleted, setVideoLength]);

  // Pause video during processing
  useEffect(() => {
    if (isProcessing && videoRef.current && isPlaying) {
      videoRef.current.pause();
    }
  }, [isProcessing, isPlaying]);

  const handlePlayPause = () => {
    if (isProcessing) return; // Don't allow play during processing
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate seam positions based on video length
  const calculateSeamPosition = (seamIndex) => {
    const bridgeDuration = 1; // 1 second bridge
    const loopDuration = videoLength + bridgeDuration;
    return seamIndex * loopDuration - 3; // Jump 3 seconds before seam
  };

  const handleSeamJump = () => {
    if (!videoRef.current || !isCompleted) return;

    const video = videoRef.current;
    const currentSeam = Math.floor((video.currentTime + 3) / (videoLength + 1));
    const nextSeamPosition = calculateSeamPosition(currentSeam + 1);

    if (nextSeamPosition < video.duration) {
      video.currentTime = Math.max(0, nextSeamPosition);
      video.play();
    } else {
      // Go back to first seam
      video.currentTime = Math.max(0, calculateSeamPosition(1));
      video.play();
    }
  };

  const progressPercent = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  return (
    <div className="preview-container">
      {/* Info icon */}
      <button className="info-button" title="About LOOPIA">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {showVideo ? (
        <div className="video-wrapper">
          <video
            ref={videoRef}
            src={displayUrl}
            className="preview-video"
            playsInline
            muted={isProcessing}
          />

          {/* Processing overlay */}
          {isProcessing && (
            <div className="processing-overlay">
              <div className="processing-indicator">
                <div className="processing-spinner"></div>
                <span className="processing-text">{progress}%</span>
              </div>
            </div>
          )}

          {/* Seam jump button (only for completed state) */}
          {isCompleted && (
            <button
              className="seam-jump-button"
              onClick={handleSeamJump}
              title={t('checkSeams')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </button>
          )}

          {/* Play/Pause overlay (hide during processing) */}
          {!isProcessing && (
            <div className="play-overlay" onClick={handlePlayPause}>
              {!isPlaying && (
                <div className="play-button">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Video controls */}
          <div className="video-controls">
            <button
              className="control-button"
              onClick={handlePlayPause}
              disabled={isProcessing}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            <div className="progress-container">
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                />
                <div
                  className="progress-handle"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(videoDuration)}
            </div>
          </div>
        </div>
      ) : (
        <div className="preview-placeholder">
          <div className="placeholder-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
