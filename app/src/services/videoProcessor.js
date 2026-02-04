import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { createRifeBridge, isRifeOnnxAvailable } from './rifeOnnx';

// Singleton FFmpeg instance
let ffmpegInstance = null;
let isLoading = false;
let loadPromise = null;

// Interpolation settings
const BRIDGE_DURATION = 0.3;
const INTERPOLATION_FPS = 24;

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

    await ffmpeg.exec([
      '-framerate', String(fps),
      '-i', 'frame_%04d.png',
      '-c:v', 'libx264',
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

    // Repeat for target duration (no limit)
    const targetSeconds = targetMinutes * 60;
    const repeatCount = Math.ceil(targetSeconds / videoDuration);

    if (repeatCount > 1) {
      let concatList = '';
      for (let i = 0; i < repeatCount; i++) {
        concatList += "file 'seamless_unit.mp4'\n";
      }
      await ffmpeg.writeFile('final_list.txt', new TextEncoder().encode(concatList));

      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'final_list.txt',
        '-c', 'copy',
        '-y',
        outputFileName
      ]);
    } else {
      await ffmpeg.exec([
        '-i', 'seamless_unit.mp4',
        '-c', 'copy',
        '-y',
        outputFileName
      ]);
    }

    onProgress?.(90);
    onStageChange?.('finalizing');

    const outputData = await ffmpeg.readFile(outputFileName);

    // Cleanup
    const filesToDelete = [
      inputFileName, 'bridge.mp4', 'main_part.mp4',
      'concat_list.txt', 'seamless_unit.mp4', 'final_list.txt', outputFileName
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

// Create seamless loop with minterpolate (fallback)
async function createSeamlessLoopWithMinterpolate(videoFile, targetMinutes, onStageChange, onProgress, onModeChange) {
  const ffmpeg = await getFFmpeg((p) => {
    if (onProgress) onProgress(Math.min(p * 0.1, 10));
  });

  try {
    onStageChange?.('analyzingVideo');
    onProgress?.(10);
    onModeChange?.('minterpolate');

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
    onProgress?.(15);

    const video = document.createElement('video');
    video.preload = 'metadata';

    const videoDuration = await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('Failed to load video metadata'));
      video.src = URL.createObjectURL(videoFile);
    });

    URL.revokeObjectURL(video.src);
    onProgress?.(20);

    onStageChange?.('interpolatingSeams');

    const bridgeDuration = Math.min(BRIDGE_DURATION, videoDuration * 0.1);
    const targetSeconds = targetMinutes * 60;
    const repeatCount = Math.ceil(targetSeconds / videoDuration);

    onProgress?.(25);

    // Extract last segment
    const lastSegmentStart = videoDuration - bridgeDuration;
    await ffmpeg.exec([
      '-i', inputFileName,
      '-ss', String(lastSegmentStart),
      '-t', String(bridgeDuration),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-an',
      '-y',
      'last_segment.mp4'
    ]);

    onProgress?.(30);

    // Extract first segment
    await ffmpeg.exec([
      '-i', inputFileName,
      '-t', String(bridgeDuration),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-an',
      '-y',
      'first_segment.mp4'
    ]);

    onProgress?.(35);

    // Concatenate last + first
    await ffmpeg.writeFile('bridge_list.txt',
      new TextEncoder().encode("file 'last_segment.mp4'\nfile 'first_segment.mp4'\n")
    );

    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'bridge_list.txt',
      '-c', 'copy',
      '-y',
      'bridge_source.mp4'
    ]);

    onProgress?.(40);

    // Apply minterpolate with simpler settings for stability
    await ffmpeg.exec([
      '-i', 'bridge_source.mp4',
      '-vf', `minterpolate=fps=${INTERPOLATION_FPS}:mi_mode=blend`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-an',
      '-y',
      'bridge_interpolated.mp4'
    ]);

    onProgress?.(55);

    // Extract middle part
    await ffmpeg.exec([
      '-i', 'bridge_interpolated.mp4',
      '-ss', String(bridgeDuration * 0.5),
      '-t', String(bridgeDuration),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-an',
      '-y',
      'bridge_final.mp4'
    ]);

    onProgress?.(60);

    // Extract main video
    const mainEnd = videoDuration - (bridgeDuration * 0.5);
    await ffmpeg.exec([
      '-i', inputFileName,
      '-t', String(mainEnd),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-an',
      '-y',
      'main_part.mp4'
    ]);

    onProgress?.(70);

    onStageChange?.('generatingLoop');

    // Create seamless loop unit
    await ffmpeg.writeFile('loop_list.txt',
      new TextEncoder().encode("file 'main_part.mp4'\nfile 'bridge_final.mp4'\n")
    );

    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'loop_list.txt',
      '-c', 'copy',
      '-y',
      'seamless_unit.mp4'
    ]);

    onProgress?.(80);

    // Repeat for target duration
    if (repeatCount > 1) {
      let concatList = '';
      for (let i = 0; i < repeatCount; i++) {
        concatList += "file 'seamless_unit.mp4'\n";
      }
      await ffmpeg.writeFile('final_list.txt', new TextEncoder().encode(concatList));

      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'final_list.txt',
        '-c', 'copy',
        '-y',
        outputFileName
      ]);
    } else {
      await ffmpeg.exec([
        '-i', 'seamless_unit.mp4',
        '-c', 'copy',
        '-y',
        outputFileName
      ]);
    }

    onProgress?.(90);
    onStageChange?.('finalizing');

    const outputData = await ffmpeg.readFile(outputFileName);

    // Cleanup
    const filesToDelete = [
      inputFileName, 'last_segment.mp4', 'first_segment.mp4',
      'bridge_list.txt', 'bridge_source.mp4', 'bridge_interpolated.mp4',
      'bridge_final.mp4', 'main_part.mp4', 'loop_list.txt',
      'seamless_unit.mp4', 'final_list.txt', outputFileName
    ];

    for (const file of filesToDelete) {
      try { await ffmpeg.deleteFile(file); } catch { /* ignore */ }
    }

    onProgress?.(100);
    onStageChange?.('complete');
    lastProcessingMode = 'minterpolate';

    const blob = new Blob([outputData], { type: 'video/mp4' });
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error('Minterpolate processing error:', error);
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
      return await createSeamlessLoopWithMinterpolate(videoFile, targetMinutes, onStageChange, onProgress, onModeChange);
    }
  }

  // No RIFE available, use minterpolate directly
  console.log('RIFE ONNX not available, using minterpolate...');
  onModeChange?.('minterpolate_no_webgpu');
  return await createSeamlessLoopWithMinterpolate(videoFile, targetMinutes, onStageChange, onProgress, onModeChange);
}
