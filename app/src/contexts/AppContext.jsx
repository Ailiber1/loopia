import { createContext, useContext, useState, useCallback, useRef } from 'react';

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

  const startProcessing = useCallback(() => {
    if (appState !== 'ready') return;

    setAppState('processing');
    setProgress(0);
    setProgressStage('analyzingVideo');
    setError(null);

    // Calculate processing time based on selected duration
    // Shorter for shorter output, longer for longer output
    const baseTime = 2000;
    const timeMultiplier = Math.min(duration / 30, 2); // Max 2x for 60 min
    const totalTime = baseTime * timeMultiplier;

    // Processing stages with dynamic timing
    const stages = [
      { stage: 'analyzingVideo', duration: totalTime * 0.5, progressEnd: 10 },
      { stage: 'interpolatingSeams', duration: totalTime * 1.5, progressEnd: 40 },
      { stage: 'generatingLoop', duration: totalTime * 2.5, progressEnd: 90 },
      { stage: 'finalizing', duration: totalTime * 0.5, progressEnd: 100 },
    ];

    let currentStage = 0;
    let currentProgress = 0;
    let intervalId = null;

    const runStage = () => {
      if (currentStage >= stages.length) {
        setAppState('completed');
        setProgressStage('complete');
        // Use original video as output for MVP (no actual processing)
        setOutputVideoUrl(videoUrl);
        return;
      }

      const stage = stages[currentStage];
      setProgressStage(stage.stage);

      const steps = stage.duration / 100;
      const progressPerStep = (stage.progressEnd - currentProgress) / (stage.duration / 100);

      intervalId = setInterval(() => {
        currentProgress += progressPerStep;
        if (currentProgress >= stage.progressEnd) {
          currentProgress = stage.progressEnd;
          clearInterval(intervalId);
          currentStage++;
          setTimeout(runStage, 100);
        }
        setProgress(Math.min(Math.round(currentProgress), 100));
      }, 100);

      processingRef.current = intervalId;
    };

    runStage();
  }, [appState, videoUrl, duration]);

  const cancelProcessing = useCallback(() => {
    if (processingRef.current) {
      clearInterval(processingRef.current);
      processingRef.current = null;
    }
    setAppState('ready');
    setProgress(0);
    setProgressStage('');
  }, []);

  const resetApp = useCallback(() => {
    if (processingRef.current) {
      clearInterval(processingRef.current);
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
