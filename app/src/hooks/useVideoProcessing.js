import { useState, useCallback, useRef } from 'react';
import { processVideo, isFFmpegSupported } from '../services/videoProcessor';

// Processing stages
const STAGES = {
  ANALYZING: 'analyzingVideo',
  INTERPOLATING: 'interpolatingSeams',
  GENERATING: 'generatingLoop',
  FINALIZING: 'finalizing',
  COMPLETE: 'complete',
};

export function useVideoProcessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState(null);
  const [outputUrl, setOutputUrl] = useState(null);
  const abortRef = useRef(null);

  // Main processing function using actual video processor
  const processVideoFile = useCallback(async (videoFile, targetMinutes) => {
    setIsProcessing(true);
    setProgress(0);
    setStage(STAGES.ANALYZING);
    setError(null);
    setOutputUrl(null);

    // Create abort controller for cancellation
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const result = await processVideo(
        videoFile,
        targetMinutes,
        (newStage) => {
          if (!abortController.signal.aborted) {
            setStage(newStage);
          }
        },
        (progressValue) => {
          if (!abortController.signal.aborted) {
            setProgress(progressValue);
          }
        }
      );

      if (!abortController.signal.aborted) {
        setOutputUrl(result);
        setIsProcessing(false);
        return result;
      }
      return null;
    } catch (err) {
      if (!abortController.signal.aborted) {
        console.error('Processing error:', err);
        setError('processingFailed');
        setIsProcessing(false);
      }
      return null;
    }
  }, []);

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsProcessing(false);
    setProgress(0);
    setStage('');
  }, []);

  // Reset state
  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
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
    processVideo: processVideoFile,
    cancelProcessing,
    reset,
    isFFmpegSupported: isFFmpegSupported(),
  };
}
