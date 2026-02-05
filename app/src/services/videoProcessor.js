import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { createRifeBridge, isRifeOnnxAvailable } from './rifeOnnx';

// Singleton FFmpeg instance
let ffmpegInstance = null;
let isLoading = false;
let loadPromise = null;

// Interpolation settings
const BLEND_DURATION = 0.5; // Shorter blend for faster processing

// Processing mode tracking
let lastProcessingMode = null;

// Get or create FFmpeg instance
async function getFFmpeg(onProgress) {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = loadFFmpeg(onProgress);

  try {
    ffmpegInstance = await loadPromise;
    return ffmpegInstance;
  } finally {
    isLoading = false;
  }
}

// Load FFmpeg with WASM files
async function loadFFmpeg(onProgress) {
  const ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });

  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress && typeof progress === 'number') {
      onProgress(Math.round(progress * 100));
    }
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

// Create seamless loop with RIFE AI interpolation (ONNX - runs in browser)
async function createSeamlessLoopWithRifeOnnx(videoFile, targetMinutes, onStageChange, onProgress, onModeChange) {
  const ffmpeg = await getFFmpeg((p) => {
    if (onProgress) onProgress(Math.min(p * 0.05, 5));
  });

  try {
    onStageChange?.('analyzingVideo');
    onProgress?.(5);
    onModeChange?.('rife');

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';

    const videoDuration = await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('Failed to load video metadata'));
      video.src = URL.createObjectURL(videoFile);
    });

    URL.revokeObjectURL(video.src);
    onProgress?.(10);

    // Calculate bitrate and estimate output size
    const fileSizeMB = videoFile.size / (1024 * 1024);
    const bitrateMBps = fileSizeMB / videoDuration; // MB per second
    const targetSeconds = targetMinutes * 60;
    const estimatedOutputMB = bitrateMBps * targetSeconds;
    const maxOutputMB = 2000; // 2GB limit for browser memory

    // Determine if compression is needed based on estimated output size
    const needsCompression = estimatedOutputMB > maxOutputMB || targetMinutes > 30;
    console.log(`[VideoProcessor] Bitrate: ${bitrateMBps.toFixed(2)} MB/s, Estimated output: ${estimatedOutputMB.toFixed(0)} MB, Compression: ${needsCompression}`);

    onStageChange?.('interpolatingSeams');

    // Create RIFE bridge using ONNX (in-browser AI)
    const rifeResult = await createRifeBridge(videoFile, (stage, p) => {
      if (stage === 'loading_model' || stage === 'downloading_model') {
        onProgress?.(10 + (p * 0.2)); // 10-30%
      } else if (stage === 'interpolating') {
        onProgress?.(30 + (p * 0.2)); // 30-50%
      }
    });

    onProgress?.(50);

    // Convert interpolated frames to video
    const canvas = document.createElement('canvas');
    canvas.width = rifeResult.originalWidth;
    canvas.height = rifeResult.originalHeight;
    const ctx = canvas.getContext('2d');

    // Write frames to FFmpeg
    for (let i = 0; i < rifeResult.frames.length; i++) {
      // Scale frame to original size
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = rifeResult.width;
      frameCanvas.height = rifeResult.height;
      const frameCtx = frameCanvas.getContext('2d');
      frameCtx.putImageData(rifeResult.frames[i], 0, 0);

      // Draw scaled to output canvas
      ctx.drawImage(frameCanvas, 0, 0, rifeResult.width, rifeResult.height,
                    0, 0, rifeResult.originalWidth, rifeResult.originalHeight);

      // Convert to PNG and write to FFmpeg
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const arrayBuffer = await blob.arrayBuffer();
      await ffmpeg.writeFile(`frame_${i.toString().padStart(4, '0')}.png`, new Uint8Array(arrayBuffer));
    }

    onProgress?.(60);

    // Create bridge video from frames
    const bridgeDuration = 0.5;
    const fps = Math.max(rifeResult.frames.length / bridgeDuration, 10);

    // Compression args based on bitrate/size detection done earlier
    const compressionArgs = needsCompression
      ? ['-crf', '28']  // Compress to reduce final file size (~1.2GB for 60min)
      : [];

    await ffmpeg.exec([
      '-framerate', String(fps),
      '-i', 'frame_%04d.png',
      '-c:v', 'libx264',
      ...compressionArgs,
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      '-y',
      'bridge.mp4'
    ]);

    onProgress?.(70);

    onStageChange?.('generatingLoop');

    // Trim main video
    const mainEnd = videoDuration - (bridgeDuration * 0.5);
    await ffmpeg.exec([
      '-i', inputFileName,
      '-t', String(mainEnd),
      '-c:v', 'libx264',
      ...compressionArgs,
      '-preset', 'fast',
      '-an',
      '-y',
      'main_part.mp4'
    ]);

    onProgress?.(75);

    // Concatenate main + bridge
    await ffmpeg.writeFile('concat_list.txt',
      new TextEncoder().encode("file 'main_part.mp4'\nfile 'bridge.mp4'\n")
    );

    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat_list.txt',
      '-c', 'copy',
      '-y',
      'seamless_unit.mp4'
    ]);

    onProgress?.(80);

    // Repeat for target duration using -stream_loop
    const seamlessUnitDuration = videoDuration - (bridgeDuration * 0.5) + bridgeDuration;
    const loopCount = Math.max(0, Math.ceil(targetSeconds / seamlessUnitDuration) - 1);

    // Always use stream copy for loop expansion (fast)
    // Compression was already applied during seamless_unit creation for 60min
    await ffmpeg.exec([
      '-stream_loop', String(loopCount),
      '-i', 'seamless_unit.mp4',
      '-t', String(targetSeconds),
      '-c', 'copy',
      '-y',
      outputFileName
    ]);

    onProgress?.(90);
    onStageChange?.('finalizing');

    const outputData = await ffmpeg.readFile(outputFileName);

    // Cleanup
    const filesToDelete = [
      inputFileName, 'bridge.mp4', 'main_part.mp4',
      'concat_list.txt', 'seamless_unit.mp4', outputFileName
    ];
    for (let i = 0; i < rifeResult.frames.length; i++) {
      filesToDelete.push(`frame_${i.toString().padStart(4, '0')}.png`);
    }

    for (const file of filesToDelete) {
      try { await ffmpeg.deleteFile(file); } catch { /* ignore */ }
    }

    onProgress?.(100);
    onStageChange?.('complete');
    lastProcessingMode = 'rife';

    const blob = new Blob([outputData], { type: 'video/mp4' });
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error('RIFE ONNX processing error:', error);
    throw error;
  }
}

// Create seamless loop - optimized for speed
async function createSeamlessLoopWithCrossfade(videoFile, targetMinutes, onStageChange, onProgress, onModeChange) {
  let currentProgress = 0;
  const updateProgress = (value) => {
    currentProgress = value;
    onProgress?.(Math.round(value));
  };

  const ffmpeg = await getFFmpeg(() => {});

  // Set up FFmpeg progress handler
  ffmpeg.on('progress', ({ progress }) => {
    if (typeof progress === 'number' && progress > 0) {
      // Map FFmpeg progress to current stage progress range
      const stageProgress = currentProgress + (progress * 20);
      onProgress?.(Math.round(Math.min(stageProgress, 95)));
    }
  });

  try {
    onStageChange?.('analyzingVideo');
    updateProgress(5);
    onModeChange?.('minterpolate');

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
    updateProgress(10);

    const video = document.createElement('video');
    video.preload = 'metadata';

    const videoDuration = await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('Failed to load video metadata'));
      video.src = URL.createObjectURL(videoFile);
    });

    URL.revokeObjectURL(video.src);
    updateProgress(15);

    // Calculate bitrate and estimate output size
    const fileSizeMB = videoFile.size / (1024 * 1024);
    const bitrateMBps = fileSizeMB / videoDuration; // MB per second
    const targetSeconds = targetMinutes * 60;
    const estimatedOutputMB = bitrateMBps * targetSeconds;
    const maxOutputMB = 2000; // 2GB limit for browser memory

    // Determine if compression is needed based on estimated output size
    const needsCompression = estimatedOutputMB > maxOutputMB || targetMinutes > 30;
    console.log(`[VideoProcessor] Crossfade - Bitrate: ${bitrateMBps.toFixed(2)} MB/s, Estimated output: ${estimatedOutputMB.toFixed(0)} MB, Compression: ${needsCompression}`);

    onStageChange?.('interpolatingSeams');

    // Short blend duration for faster processing
    const blendDuration = Math.min(BLEND_DURATION, videoDuration * 0.1);

    // Compression based on bitrate/size detection
    const crfValue = needsCompression ? '28' : '23';

    updateProgress(20);

    // Step 1: Create seamless unit with xfade
    const xfadeOffset = videoDuration - blendDuration;

    await ffmpeg.exec([
      '-i', inputFileName,
      '-i', inputFileName,
      '-filter_complex',
      `[0:v]trim=0:${xfadeOffset},setpts=PTS-STARTPTS[main];` +
      `[0:v]trim=${xfadeOffset}:${videoDuration},setpts=PTS-STARTPTS[end];` +
      `[1:v]trim=0:${blendDuration},setpts=PTS-STARTPTS[start];` +
      `[end][start]xfade=transition=fade:duration=${blendDuration}:offset=0[blend];` +
      `[main][blend]concat=n=2:v=1:a=0[out]`,
      '-map', '[out]',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', crfValue,
      '-pix_fmt', 'yuv420p',
      '-an',
      '-y',
      'seamless_unit.mp4'
    ]);

    updateProgress(50);

    onStageChange?.('generatingLoop');

    // Step 2: Fast repeat using -stream_loop (always use -c copy for speed)
    // Compression was already applied during seamless_unit creation for 60min
    const seamlessUnitDuration = videoDuration - blendDuration;
    const loopCount = Math.max(0, Math.ceil(targetSeconds / seamlessUnitDuration) - 1);

    updateProgress(60);

    // Always use stream copy for loop expansion (fast)
    await ffmpeg.exec([
      '-stream_loop', String(loopCount),
      '-i', 'seamless_unit.mp4',
      '-t', String(targetSeconds),
      '-c', 'copy',
      '-y',
      outputFileName
    ]);

    updateProgress(90);
    onStageChange?.('finalizing');

    const outputData = await ffmpeg.readFile(outputFileName);

    // Cleanup
    const filesToDelete = [inputFileName, 'seamless_unit.mp4', outputFileName];

    for (const file of filesToDelete) {
      try { await ffmpeg.deleteFile(file); } catch { /* ignore */ }
    }

    updateProgress(100);
    onStageChange?.('complete');
    lastProcessingMode = 'crossfade';

    const blob = new Blob([outputData], { type: 'video/mp4' });
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error('Crossfade processing error:', error);
    throw error;
  }
}

// Check if FFmpeg.wasm is supported
export function isFFmpegSupported() {
  return typeof SharedArrayBuffer !== 'undefined';
}

// Get last processing mode
export function getLastProcessingMode() {
  return lastProcessingMode;
}

// Check if RIFE ONNX is available
export async function isRifeAvailable() {
  return await isRifeOnnxAvailable();
}

// Main processing function with RIFE ONNX priority and fallback
export async function processVideo(videoFile, targetMinutes, onStageChange, onProgress, onModeChange) {
  if (!isFFmpegSupported()) {
    throw new Error('SharedArrayBuffer not supported');
  }

  // Check if RIFE ONNX is available (WebGPU or WebGL)
  const rifeAvailable = await isRifeOnnxAvailable();

  if (rifeAvailable) {
    try {
      console.log('Attempting RIFE ONNX interpolation (in-browser AI)...');
      return await createSeamlessLoopWithRifeOnnx(videoFile, targetMinutes, onStageChange, onProgress, onModeChange);
    } catch (error) {
      console.warn('RIFE ONNX failed, falling back to minterpolate:', error.message);
      onModeChange?.('fallback_error');
      return await createSeamlessLoopWithCrossfade(videoFile, targetMinutes, onStageChange, onProgress, onModeChange);
    }
  }

  // No RIFE available, use minterpolate directly
  console.log('RIFE ONNX not available, using minterpolate...');
  onModeChange?.('minterpolate_no_webgpu');
  return await createSeamlessLoopWithCrossfade(videoFile, targetMinutes, onStageChange, onProgress, onModeChange);
}
