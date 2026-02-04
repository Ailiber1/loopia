import { createContext, useContext, useState, useCallback } from 'react';

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

  const uploadVideo = useCallback((file) => {
    setAppState('uploading');
    setVideoFile(file);
    setError(null);

    // Create local URL for preview
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    // Simulate upload completion
    setTimeout(() => {
      setAppState('ready');
    }, 1000);
  }, []);

  const startProcessing = useCallback(() => {
    if (appState !== 'ready') return;

    setAppState('processing');
    setProgress(0);
    setProgressStage('analyzingVideo');
    setError(null);

    // Simulate processing stages
    const stages = [
      { stage: 'analyzingVideo', duration: 2000, progressEnd: 10 },
      { stage: 'interpolatingSeams', duration: 5000, progressEnd: 40 },
      { stage: 'generatingLoop', duration: 8000, progressEnd: 90 },
      { stage: 'finalizing', duration: 2000, progressEnd: 100 },
    ];

    let currentStage = 0;
    let currentProgress = 0;

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

      const progressIncrement = (stage.progressEnd - currentProgress) / (stage.duration / 100);
      const progressInterval = setInterval(() => {
        currentProgress += progressIncrement;
        if (currentProgress >= stage.progressEnd) {
          currentProgress = stage.progressEnd;
          clearInterval(progressInterval);
          currentStage++;
          setTimeout(runStage, 100);
        }
        setProgress(Math.min(Math.round(currentProgress), 100));
      }, 100);
    };

    runStage();
  }, [appState, videoUrl]);

  const resetApp = useCallback(() => {
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
