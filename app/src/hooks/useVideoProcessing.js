import { useState, useCallback, useRef } from 'react';

// Processing stages
const STAGES = {
  ANALYZING: 'analyzingVideo',
  INTERPOLATING: 'interpolatingSeams',
  GENERATING: 'generatingLoop',
  FINALIZING: 'finalizing',
  COMPLETE: 'complete',
};

// Crossfade duration in seconds
const CROSSFADE_DURATION = 0.5;

export function useVideoProcessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState(null);
  const [outputUrl, setOutputUrl] = useState(null);
  const canvasRef = useRef(null);
  const abortRef = useRef(false);

  // Create a seamless loop using canvas-based crossfade
  const createCrossfadeLoop = useCallback(async (videoUrl, videoDuration, targetMinutes) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;

      video.onloadedmetadata = async () => {
        try {
          // For MVP, we'll simulate the processing and return the original video
          // In production, this would use MediaRecorder and Canvas for actual crossfade

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;

          // Simulate processing time based on target duration
          const totalProcessingTime = Math.min(targetMinutes * 500, 15000); // Max 15 seconds
          const startTime = Date.now();

          // Stage 1: Analyzing (0-10%)
          setStage(STAGES.ANALYZING);
          await simulateProgress(0, 10, totalProcessingTime * 0.1);
          if (abortRef.current) throw new Error('Aborted');

          // Stage 2: Interpolating (10-40%)
          setStage(STAGES.INTERPOLATING);
          await simulateProgress(10, 40, totalProcessingTime * 0.3);
          if (abortRef.current) throw new Error('Aborted');

          // Stage 3: Generating (40-90%)
          setStage(STAGES.GENERATING);
          await simulateProgress(40, 90, totalProcessingTime * 0.5);
          if (abortRef.current) throw new Error('Aborted');

          // Stage 4: Finalizing (90-100%)
          setStage(STAGES.FINALIZING);
          await simulateProgress(90, 100, totalProcessingTime * 0.1);

          setStage(STAGES.COMPLETE);
          setProgress(100);

          // For MVP, return original video URL
          // In production, this would return the processed video blob URL
          resolve(videoUrl);
        } catch (err) {
          reject(err);
        }
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      video.src = videoUrl;
      video.load();
    });
  }, []);

  // Simulate progress updates
  const simulateProgress = async (startProgress, endProgress, duration) => {
    const steps = 20;
    const stepDuration = duration / steps;
    const progressPerStep = (endProgress - startProgress) / steps;

    for (let i = 0; i < steps; i++) {
      if (abortRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, stepDuration));
      setProgress(Math.round(startProgress + progressPerStep * (i + 1)));
    }
  };

  // Main processing function
  const processVideo = useCallback(async (videoUrl, videoDuration, targetMinutes) => {
    setIsProcessing(true);
    setProgress(0);
    setStage(STAGES.ANALYZING);
    setError(null);
    setOutputUrl(null);
    abortRef.current = false;

    try {
      const result = await createCrossfadeLoop(videoUrl, videoDuration, targetMinutes);
      setOutputUrl(result);
      setIsProcessing(false);
      return result;
    } catch (err) {
      if (err.message === 'Aborted') {
        setError(null);
      } else {
        setError('processingTimeout');
      }
      setIsProcessing(false);
      return null;
    }
  }, [createCrossfadeLoop]);

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    abortRef.current = true;
    setIsProcessing(false);
    setProgress(0);
    setStage('');
  }, []);

  // Reset state
  const reset = useCallback(() => {
    abortRef.current = true;
    setIsProcessing(false);
    setProgress(0);
    setStage('');
    setError(null);
    if (outputUrl && outputUrl.startsWith('blob:')) {
      URL.revokeObjectURL(outputUrl);
    }
    setOutputUrl(null);
  }, [outputUrl]);

  return {
    isProcessing,
    progress,
    stage,
    error,
    outputUrl,
    processVideo,
    cancelProcessing,
    reset,
  };
}
