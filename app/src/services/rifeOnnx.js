// RIFE Frame Interpolation using ONNX Runtime Web
// Runs entirely in the browser using WebGPU/WebGL - completely free and unlimited

import * as ort from 'onnxruntime-web';

// Model configuration
const MODEL_URL = 'https://huggingface.co/nickmuchi/rife-onnx/resolve/main/rife_v4.6.onnx';
const MODEL_CACHE_KEY = 'rife-model-v4.6';

let session = null;
let isLoading = false;
let loadPromise = null;

// Check if WebGPU is available
export async function isWebGpuAvailable() {
  if (typeof navigator === 'undefined') return false;

  if ('gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }
  return false;
}

// Check if WebGL is available (fallback)
export function isWebGlAvailable() {
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

// Get the best available execution provider
export async function getBestExecutionProvider() {
  if (await isWebGpuAvailable()) {
    return 'webgpu';
  }
  if (isWebGlAvailable()) {
    return 'webgl';
  }
  return 'wasm'; // CPU fallback
}

// Initialize ONNX Runtime session
async function initSession(onProgress) {
  if (session) return session;
  if (isLoading && loadPromise) return loadPromise;

  isLoading = true;

  loadPromise = (async () => {
    try {
      onProgress?.('loading_model', 0);

      // Get the best execution provider
      const provider = await getBestExecutionProvider();
      console.log(`[RIFE ONNX] Using execution provider: ${provider}`);

      // Configure session options
      const sessionOptions = {
        executionProviders: [provider],
        graphOptimizationLevel: 'all',
      };

      onProgress?.('loading_model', 20);

      // Try to load from cache first (IndexedDB)
      let modelBuffer = await loadModelFromCache();

      if (!modelBuffer) {
        onProgress?.('downloading_model', 30);
        console.log('[RIFE ONNX] Downloading model...');

        // Download model
        const response = await fetch(MODEL_URL);
        if (!response.ok) {
          throw new Error(`Failed to download model: ${response.status}`);
        }

        const total = parseInt(response.headers.get('content-length') || '0', 10);
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          received += value.length;

          if (total > 0) {
            const progress = 30 + (received / total) * 40;
            onProgress?.('downloading_model', Math.round(progress));
          }
        }

        modelBuffer = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          modelBuffer.set(chunk, offset);
          offset += chunk.length;
        }

        // Cache the model
        await saveModelToCache(modelBuffer);
      }

      onProgress?.('initializing_model', 75);

      // Create session
      session = await ort.InferenceSession.create(modelBuffer.buffer, sessionOptions);

      onProgress?.('ready', 100);
      console.log('[RIFE ONNX] Model loaded successfully');

      return session;
    } catch (error) {
      console.error('[RIFE ONNX] Failed to load model:', error);
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

// Cache model in IndexedDB
async function saveModelToCache(buffer) {
  try {
    const db = await openCacheDB();
    const tx = db.transaction('models', 'readwrite');
    const store = tx.objectStore('models');
    await store.put({ id: MODEL_CACHE_KEY, data: buffer, timestamp: Date.now() });
    db.close();
  } catch (e) {
    console.warn('[RIFE ONNX] Failed to cache model:', e);
  }
}

async function loadModelFromCache() {
  try {
    const db = await openCacheDB();
    const tx = db.transaction('models', 'readonly');
    const store = tx.objectStore('models');

    return new Promise((resolve) => {
      const request = store.get(MODEL_CACHE_KEY);
      request.onsuccess = () => {
        db.close();
        if (request.result) {
          console.log('[RIFE ONNX] Loaded model from cache');
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

function openCacheDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('loopia-models', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('models')) {
        db.createObjectStore('models', { keyPath: 'id' });
      }
    };
  });
}

// Convert image data to tensor
function imageDataToTensor(imageData, width, height) {
  const { data } = imageData;
  const float32Data = new Float32Array(3 * height * width);

  // Convert RGBA to RGB and normalize to [0, 1]
  for (let i = 0; i < height * width; i++) {
    float32Data[i] = data[i * 4] / 255.0; // R
    float32Data[height * width + i] = data[i * 4 + 1] / 255.0; // G
    float32Data[2 * height * width + i] = data[i * 4 + 2] / 255.0; // B
  }

  return new ort.Tensor('float32', float32Data, [1, 3, height, width]);
}

// Convert tensor to image data
function tensorToImageData(tensor, width, height) {
  const data = tensor.data;
  const imageData = new ImageData(width, height);

  for (let i = 0; i < height * width; i++) {
    imageData.data[i * 4] = Math.round(Math.max(0, Math.min(255, data[i] * 255))); // R
    imageData.data[i * 4 + 1] = Math.round(Math.max(0, Math.min(255, data[height * width + i] * 255))); // G
    imageData.data[i * 4 + 2] = Math.round(Math.max(0, Math.min(255, data[2 * height * width + i] * 255))); // B
    imageData.data[i * 4 + 3] = 255; // A
  }

  return imageData;
}

// Extract frame from video at specific time
async function extractFrameAsImageData(video, time, targetWidth, targetHeight) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const handleSeeked = () => {
      video.removeEventListener('seeked', handleSeeked);
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      resolve(ctx.getImageData(0, 0, targetWidth, targetHeight));
    };

    video.addEventListener('seeked', handleSeeked);
    video.currentTime = time;

    // Timeout fallback
    setTimeout(() => {
      video.removeEventListener('seeked', handleSeeked);
      reject(new Error('Frame extraction timeout'));
    }, 5000);
  });
}

// Interpolate between two frames using RIFE
export async function interpolateFrames(frame1ImageData, frame2ImageData, numInterpolations = 1, onProgress) {
  const inferenceSession = await initSession(onProgress);

  const width = frame1ImageData.width;
  const height = frame1ImageData.height;

  // Ensure dimensions are multiples of 32 for RIFE
  const padWidth = Math.ceil(width / 32) * 32;
  const padHeight = Math.ceil(height / 32) * 32;

  // Convert frames to tensors
  const tensor1 = imageDataToTensor(frame1ImageData, padWidth, padHeight);
  const tensor2 = imageDataToTensor(frame2ImageData, padWidth, padHeight);

  const interpolatedFrames = [];

  for (let i = 0; i < numInterpolations; i++) {
    const t = (i + 1) / (numInterpolations + 1);

    // Create timestep tensor
    const timestep = new ort.Tensor('float32', new Float32Array([t]), [1, 1, 1, 1]);

    // Run inference
    const feeds = {
      img0: tensor1,
      img1: tensor2,
      timestep: timestep,
    };

    const results = await inferenceSession.run(feeds);
    const outputTensor = results.output || results[Object.keys(results)[0]];

    // Convert output to ImageData
    const interpolatedFrame = tensorToImageData(outputTensor, width, height);
    interpolatedFrames.push(interpolatedFrame);

    onProgress?.('interpolating', Math.round((i + 1) / numInterpolations * 100));
  }

  return interpolatedFrames;
}

// Main function: Create seamless loop bridge using RIFE
export async function createRifeBridge(videoFile, onProgress) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;

  const videoUrl = URL.createObjectURL(videoFile);
  video.src = videoUrl;

  try {
    // Wait for video to load
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Failed to load video'));
    });

    const duration = video.duration;
    const width = Math.min(video.videoWidth, 512); // Limit size for performance
    const height = Math.min(video.videoHeight, 512);

    onProgress?.('extracting_frames', 10);

    // Extract last frame
    const lastFrame = await extractFrameAsImageData(video, Math.max(0, duration - 0.05), width, height);
    onProgress?.('extracting_frames', 30);

    // Extract first frame
    const firstFrame = await extractFrameAsImageData(video, 0.05, width, height);
    onProgress?.('extracting_frames', 50);

    // Interpolate frames
    onProgress?.('interpolating', 60);
    const interpolatedFrames = await interpolateFrames(lastFrame, firstFrame, 8, onProgress);

    onProgress?.('complete', 100);

    return {
      success: true,
      frames: interpolatedFrames,
      width,
      height,
      originalWidth: video.videoWidth,
      originalHeight: video.videoHeight,
    };
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

// Check if RIFE ONNX is available and usable
export async function isRifeOnnxAvailable() {
  const hasWebGpu = await isWebGpuAvailable();
  const hasWebGl = isWebGlAvailable();
  return hasWebGpu || hasWebGl;
}
