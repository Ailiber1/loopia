import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { processVideo, isRifeAvailable } from '../services/videoProcessor';

// App States:
// - idle: Initial state, no video uploaded
// - uploading: Video is being uploaded
// - ready: Video uploaded, ready to start processing
// - processing: Loop generation in progress
// - completed: Loop generation completed
// - error: Error occurred

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [appState, setAppState] = useState('idle');
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [duration, setDuration] = useState(60); // Default: 60 min
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [outputVideoUrl, setOutputVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [videoLength, setVideoLength] = useState(0);
  const [processingMode, setProcessingMode] = useState(null); // 'rife' or 'minterpolate'
  const [notification, setNotification] = useState(null); // For mode switch notifications
  const [rifeAvailable, setRifeAvailable] = useState(false);
  const processingRef = useRef(null);

  // Check RIFE availability on mount
  useEffect(() => {
    isRifeAvailable().then(setRifeAvailable);
  }, []);

  const uploadVideo = useCallback((file) => {
    setAppState('uploading');
    setVideoFile(file);
    setError(null);
    setNotification(null);

    // Create local URL for preview
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoLength(video.duration);
      URL.revokeObjectURL(video.src);
      setAppState('ready');
    };
    video.onerror = () => {
      setAppState('ready');
    };
    video.src = url;
  }, []);

  const startProcessing = useCallback(async () => {
    if (appState !== 'ready' || !videoFile) return;

    setAppState('processing');
    setProgress(0);
    setProgressStage('analyzingVideo');
    setError(null);
    setNotification(null);
    setProcessingMode(null);

    // Store abort controller for cancellation
    const abortController = new AbortController();
    processingRef.current = abortController;

    try {
      // Use actual video processing with mode change callback
      const outputUrl = await processVideo(
        videoFile,
        duration,
        (stage) => {
          if (!abortController.signal.aborted) {
            setProgressStage(stage);
          }
        },
        (progressValue) => {
          if (!abortController.signal.aborted) {
            setProgress(progressValue);
          }
        },
        (mode) => {
          if (!abortController.signal.aborted) {
            // Handle mode changes
            if (mode === 'rife') {
              setProcessingMode('rife');
            } else if (mode === 'minterpolate') {
              setProcessingMode('minterpolate');
            } else if (mode === 'fallback_error') {
              setProcessingMode('minterpolate');
              setNotification('rifeFallback');
            } else if (mode === 'minterpolate_no_webgpu') {
              setProcessingMode('minterpolate');
            }
          }
        }
      );

      if (!abortController.signal.aborted) {
        // Handle both single URL (string) and multiple URLs (array) for split videos
        setOutputVideoUrl(outputUrl);
        setAppState('completed');
        setProgressStage('complete');
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        console.error('Processing error:', err);
        setError('processingFailed');
        setAppState('error');
      }
    }
  }, [appState, videoFile, duration]);

  const cancelProcessing = useCallback(() => {
    if (processingRef.current) {
      if (processingRef.current.abort) {
        processingRef.current.abort();
      } else if (typeof processingRef.current === 'number') {
        clearInterval(processingRef.current);
      }
      processingRef.current = null;
    }
    setAppState('ready');
    setProgress(0);
    setProgressStage('');
    setProcessingMode(null);
  }, []);

  const resetApp = useCallback(() => {
    if (processingRef.current) {
      if (processingRef.current.abort) {
        processingRef.current.abort();
      } else if (typeof processingRef.current === 'number') {
        clearInterval(processingRef.current);
      }
      processingRef.current = null;
    }
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    // Handle both single URL and array of URLs (for split videos)
    if (outputVideoUrl) {
      if (Array.isArray(outputVideoUrl)) {
        outputVideoUrl.forEach(url => URL.revokeObjectURL(url));
      } else if (outputVideoUrl !== videoUrl) {
        URL.revokeObjectURL(outputVideoUrl);
      }
    }
    setAppState('idle');
    setVideoFile(null);
    setVideoUrl(null);
    setDuration(60);
    setProgress(0);
    setProgressStage('');
    setOutputVideoUrl(null);
    setError(null);
    setVideoLength(0);
    setProcessingMode(null);
    setNotification(null);
  }, [videoUrl, outputVideoUrl]);

  const setErrorState = useCallback((errorMessage) => {
    setError(errorMessage);
    setAppState('error');
  }, []);

  const retryFromError = useCallback(() => {
    setError(null);
    setNotification(null);
    if (videoFile) {
      setAppState('ready');
    } else {
      setAppState('idle');
    }
  }, [videoFile]);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        appState,
        videoFile,
        videoUrl,
        duration,
        setDuration,
        progress,
        progressStage,
        outputVideoUrl,
        error,
        videoLength,
        setVideoLength,
        processingMode,
        notification,
        isRifeAvailable: rifeAvailable,
        uploadVideo,
        startProcessing,
        cancelProcessing,
        resetApp,
        setErrorState,
        retryFromError,
        clearNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
