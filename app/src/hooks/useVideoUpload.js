import { useState, useCallback } from 'react';

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MIN_DURATION = 3; // 3 seconds minimum
const MAX_DURATION = 15; // 15 seconds recommended max

export function useVideoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const validateFile = useCallback((file) => {
    // Check file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return { valid: false, error: 'unsupportedFormat' };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'fileTooLarge' };
    }

    return { valid: true, error: null };
  }, []);

  const getVideoDuration = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video metadata'));
      };

      video.src = URL.createObjectURL(file);
    });
  }, []);

  const validateDuration = useCallback(async (file) => {
    try {
      const duration = await getVideoDuration(file);

      if (duration < MIN_DURATION) {
        return { valid: false, error: 'videoTooShort', duration };
      }

      return { valid: true, error: null, duration };
    } catch (err) {
      return { valid: false, error: 'uploadFailed', duration: 0 };
    }
  }, [getVideoDuration]);

  const uploadFile = useCallback(async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Validate file type and size
      const fileValidation = validateFile(file);
      if (!fileValidation.valid) {
        setError(fileValidation.error);
        setIsUploading(false);
        return null;
      }

      // Validate video duration
      const durationValidation = await validateDuration(file);
      if (!durationValidation.valid) {
        setError(durationValidation.error);
        setIsUploading(false);
        return null;
      }

      // Create local URL for preview (local mode)
      const url = URL.createObjectURL(file);

      // Simulate upload progress for local mode
      for (let i = 0; i <= 100; i += 20) {
        setUploadProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setIsUploading(false);
      setUploadProgress(100);

      return {
        file,
        url,
        duration: durationValidation.duration,
        name: file.name,
        size: file.size,
      };
    } catch (err) {
      setError('uploadFailed');
      setIsUploading(false);
      return null;
    }
  }, [validateFile, validateDuration]);

  const reset = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setError(null);
  }, []);

  return {
    isUploading,
    uploadProgress,
    error,
    uploadFile,
    validateFile,
    validateDuration,
    reset,
  };
}
