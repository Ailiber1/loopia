import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Singleton FFmpeg instance
let ffmpegInstance = null;
let isLoading = false;
let loadPromise = null;

// Crossfade duration in seconds
const CROSSFADE_DURATION = 0.5;

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

  // Load FFmpeg core from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

// Create a seamless loop video with crossfade
export async function createSeamlessLoop(videoFile, targetMinutes, onStageChange, onProgress) {
  const ffmpeg = await getFFmpeg((p) => {
    // Progress during FFmpeg loading
    if (onProgress) onProgress(Math.min(p * 0.1, 10)); // 0-10% for loading
  });

  try {
    // Stage 1: Analyzing video
    onStageChange?.('analyzingVideo');
    onProgress?.(10);

    // Write input file to FFmpeg virtual filesystem
    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
    onProgress?.(15);

    // Get video duration using ffprobe-like approach
    // We'll use the duration passed or estimate it
    const video = document.createElement('video');
    video.preload = 'metadata';

    const videoDuration = await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = () => reject(new Error('Failed to load video metadata'));
      video.src = URL.createObjectURL(videoFile);
    });

    URL.revokeObjectURL(video.src);
    onProgress?.(20);

    // Stage 2: Creating seamless loop with crossfade
    onStageChange?.('interpolatingSeams');

    // Calculate loop parameters
    const crossfadeDuration = Math.min(CROSSFADE_DURATION, videoDuration * 0.1);
    const loopUnitDuration = videoDuration; // Original video becomes the loop unit

    // Calculate how many times to repeat for target duration
    const targetSeconds = targetMinutes * 60;
    const repeatCount = Math.ceil(targetSeconds / loopUnitDuration);

    // For very long durations, we'll create a reasonable loop unit
    // and let the user play it on loop in their video player
    const maxRepeats = Math.min(repeatCount, 10); // Limit to prevent memory issues

    onProgress?.(30);

    // Create the seamless loop using FFmpeg filters
    // Strategy: Create crossfade between end and beginning

    // Step 1: Split video and create crossfade
    // We'll create: [original video without last 0.5s] + [crossfade of last 0.5s to first 0.5s]

    const trimEnd = videoDuration - crossfadeDuration;

    // Create seamless loop unit with crossfade filter
    // This filter creates a smooth transition from end to beginning
    await ffmpeg.exec([
      '-i', inputFileName,
      '-filter_complex',
      `[0:v]split=2[main][fade];` +
      `[main]trim=0:${trimEnd},setpts=PTS-STARTPTS[trimmed];` +
      `[fade]trim=${trimEnd}:${videoDuration},setpts=PTS-STARTPTS[end];` +
      `[0:v]trim=0:${crossfadeDuration},setpts=PTS-STARTPTS[start];` +
      `[end][start]xfade=transition=fade:duration=${crossfadeDuration}:offset=0[xfaded];` +
      `[trimmed][xfaded]concat=n=2:v=1:a=0[outv]`,
      '-map', '[outv]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y',
      'seamless_unit.mp4'
    ]);

    onProgress?.(50);
    onStageChange?.('generatingLoop');

    // Step 2: If we need multiple repeats, concatenate the seamless unit
    if (maxRepeats > 1) {
      // Create concat file list
      let concatList = '';
      for (let i = 0; i < maxRepeats; i++) {
        concatList += `file 'seamless_unit.mp4'\n`;
      }

      await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));

      onProgress?.(60);

      // Concatenate multiple loops
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        '-y',
        outputFileName
      ]);
    } else {
      // Just rename the seamless unit
      await ffmpeg.exec([
        '-i', 'seamless_unit.mp4',
        '-c', 'copy',
        '-y',
        outputFileName
      ]);
    }

    onProgress?.(90);
    onStageChange?.('finalizing');

    // Read the output file
    const outputData = await ffmpeg.readFile(outputFileName);

    // Clean up virtual filesystem
    try {
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile('seamless_unit.mp4');
      await ffmpeg.deleteFile(outputFileName);
      await ffmpeg.deleteFile('concat.txt').catch(() => {});
    } catch {
      // Ignore cleanup errors
    }

    onProgress?.(100);
    onStageChange?.('complete');

    // Create blob URL for the output
    const blob = new Blob([outputData], { type: 'video/mp4' });
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error('Video processing error:', error);
    throw error;
  }
}

// Simpler approach: Create crossfade loop using Canvas + MediaRecorder
// This is a fallback if FFmpeg.wasm fails
export async function createCanvasLoop(videoFile, targetMinutes, onStageChange, onProgress) {
  onStageChange?.('analyzingVideo');
  onProgress?.(5);

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;

  const videoUrl = URL.createObjectURL(videoFile);
  video.src = videoUrl;

  await new Promise((res, rej) => {
    video.onloadedmetadata = res;
    video.onerror = () => rej(new Error('Failed to load video'));
  });

  const duration = video.duration;
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  onProgress?.(10);
  onStageChange?.('interpolatingSeams');

  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Setup MediaRecorder
  const stream = canvas.captureStream(30);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 5000000
  });

  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const crossfadeDuration = Math.min(0.5, duration * 0.1);
  const targetDuration = Math.min(targetMinutes * 60, duration * 5); // Limit for browser
  const loopsNeeded = Math.ceil(targetDuration / duration);
  const actualLoops = Math.min(loopsNeeded, 3); // Limit loops for browser performance

  onProgress?.(20);
  onStageChange?.('generatingLoop');

  return new Promise((resolve, reject) => {
    let currentLoop = 0;
    let recordingComplete = false;

    mediaRecorder.onstop = () => {
      recordingComplete = true;
      const blob = new Blob(chunks, { type: 'video/webm' });
      URL.revokeObjectURL(videoUrl);
      resolve(URL.createObjectURL(blob));
    };

    mediaRecorder.onerror = (err) => {
      reject(err);
    };

    // Start recording
    mediaRecorder.start();

    const renderFrame = () => {
      if (recordingComplete) return;

      ctx.drawImage(video, 0, 0, width, height);

      // Apply crossfade at loop boundaries
      const timeInLoop = video.currentTime;
      const timeUntilEnd = duration - timeInLoop;

      if (timeUntilEnd < crossfadeDuration && currentLoop < actualLoops - 1) {
        // We're near the end, start fading
        const fadeProgress = 1 - (timeUntilEnd / crossfadeDuration);
        ctx.globalAlpha = fadeProgress * 0.3; // Subtle fade effect
        // The next frame will blend naturally due to video loop
      } else {
        ctx.globalAlpha = 1;
      }
    };

    video.ontimeupdate = () => {
      const progress = 20 + ((currentLoop + video.currentTime / duration) / actualLoops) * 70;
      onProgress?.(Math.min(Math.round(progress), 90));
    };

    video.onended = () => {
      currentLoop++;
      if (currentLoop < actualLoops) {
        video.currentTime = 0;
        video.play();
      } else {
        onProgress?.(95);
        onStageChange?.('finalizing');
        mediaRecorder.stop();
        onProgress?.(100);
        onStageChange?.('complete');
      }
    };

    video.onerror = () => {
      reject(new Error('Video playback error'));
    };

    // Render loop
    const animate = () => {
      if (!recordingComplete) {
        renderFrame();
        requestAnimationFrame(animate);
      }
    };

    video.play();
    animate();
  });
}

// Check if FFmpeg.wasm is supported
export function isFFmpegSupported() {
  return typeof SharedArrayBuffer !== 'undefined';
}

// Main processing function that chooses the best method
export async function processVideo(videoFile, targetMinutes, onStageChange, onProgress) {
  if (isFFmpegSupported()) {
    try {
      return await createSeamlessLoop(videoFile, targetMinutes, onStageChange, onProgress);
    } catch (error) {
      console.warn('FFmpeg processing failed, falling back to Canvas method:', error);
      return await createCanvasLoop(videoFile, targetMinutes, onStageChange, onProgress);
    }
  } else {
    console.log('SharedArrayBuffer not available, using Canvas method');
    return await createCanvasLoop(videoFile, targetMinutes, onStageChange, onProgress);
  }
}
