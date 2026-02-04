import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { processVideo } from '../services/videoProcessor';

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
  const processingRef = useRef(null);

  const uploadVideo = useCallback((file) => {
    setAppState('uploading');
    setVideoFile(file);
    setError(null);

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

    // Store abort controller for cancellation
    const abortController = new AbortController();
    processingRef.current = abortController;

    try {
      // Use actual video processing
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
        }
      );

      if (!abortController.signal.aborted) {
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
      // Handle both AbortController and interval-based cancellation
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
    if (outputVideoUrl && outputVideoUrl !== videoUrl) {
      URL.revokeObjectURL(outputVideoUrl);
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
  }, [videoUrl, outputVideoUrl]);

  const setErrorState = useCallback((errorMessage) => {
    setError(errorMessage);
    setAppState('error');
  }, []);

  const retryFromError = useCallback(() => {
    setError(null);
    if (videoFile) {
      setAppState('ready');
    } else {
      setAppState('idle');
    }
  }, [videoFile]);

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
        uploadVideo,
        startProcessing,
        cancelProcessing,
        resetApp,
        setErrorState,
        retryFromError,
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
