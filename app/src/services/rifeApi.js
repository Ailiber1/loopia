// RIFE Frame Interpolation API Service using Replicate
// Requires VITE_REPLICATE_API_TOKEN environment variable

const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';

// RIFE model on Replicate (frame interpolation)
const RIFE_MODEL = 'pollinations/rife-interpolation:cd25cd6e9fb0ef2e6eb66f54f35f3a91d7e06e9bfb72c8e7f87f49a4ff2eb22b';

// Check if API is available
export function isRifeApiAvailable() {
  const token = import.meta.env.VITE_REPLICATE_API_TOKEN;
  return token && token !== 'your-api-token-here';
}

// Get API token
function getApiToken() {
  return import.meta.env.VITE_REPLICATE_API_TOKEN;
}

// Convert file to base64 data URL
async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Convert blob to base64 data URL
async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Extract frame from video at specific time
async function extractFrame(videoUrl, time) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = time;
    };

    video.onseeked = () => {
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    };

    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = videoUrl;
  });
}

// Call Replicate API for RIFE interpolation
async function callReplicateApi(frame1DataUrl, frame2DataUrl, numFrames = 8) {
  const token = getApiToken();

  if (!token) {
    throw new Error('REPLICATE_API_TOKEN_NOT_SET');
  }

  // Start prediction
  const response = await fetch(REPLICATE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: RIFE_MODEL.split(':')[1],
      input: {
        frame1: frame1DataUrl,
        frame2: frame2DataUrl,
        times_to_interpolate: Math.log2(numFrames + 1), // RIFE uses power of 2
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 402 || response.status === 429) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  const prediction = await response.json();

  // Poll for completion
  return await pollPrediction(prediction.id, token);
}

// Poll prediction status until complete
async function pollPrediction(predictionId, token, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
      headers: {
        'Authorization': `Token ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check prediction status: ${response.status}`);
    }

    const prediction = await response.json();

    if (prediction.status === 'succeeded') {
      return prediction.output;
    } else if (prediction.status === 'failed') {
      throw new Error(prediction.error || 'Prediction failed');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Prediction timeout');
}

// Main function: Interpolate frames between video end and start using RIFE
export async function interpolateWithRife(videoFile, onProgress) {
  if (!isRifeApiAvailable()) {
    throw new Error('REPLICATE_API_TOKEN_NOT_SET');
  }

  const videoUrl = URL.createObjectURL(videoFile);

  try {
    onProgress?.(5);

    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';

    const duration = await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = reject;
      video.src = videoUrl;
    });

    onProgress?.(10);

    // Extract last frame (end of video)
    const lastFrameTime = Math.max(0, duration - 0.05); // Slightly before end
    const lastFrame = await extractFrame(videoUrl, lastFrameTime);
    const lastFrameDataUrl = await blobToDataUrl(lastFrame);

    onProgress?.(20);

    // Extract first frame (start of video)
    const firstFrame = await extractFrame(videoUrl, 0.05); // Slightly after start
    const firstFrameDataUrl = await blobToDataUrl(firstFrame);

    onProgress?.(30);

    // Call RIFE API to generate intermediate frames
    const interpolatedFrames = await callReplicateApi(lastFrameDataUrl, firstFrameDataUrl, 8);

    onProgress?.(80);

    return {
      success: true,
      frames: interpolatedFrames, // Array of frame URLs
      duration: duration,
    };

  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

// Check API status (for UI display)
export async function checkApiStatus() {
  if (!isRifeApiAvailable()) {
    return { available: false, reason: 'NO_API_KEY' };
  }

  try {
    // Simple health check - just verify token works
    const response = await fetch('https://api.replicate.com/v1/models', {
      headers: {
        'Authorization': `Token ${getApiToken()}`,
      },
    });

    if (response.status === 401) {
      return { available: false, reason: 'INVALID_API_KEY' };
    }

    if (response.status === 429) {
      return { available: false, reason: 'RATE_LIMITED' };
    }

    return { available: response.ok, reason: response.ok ? null : 'API_ERROR' };
  } catch {
    return { available: false, reason: 'NETWORK_ERROR' };
  }
}
