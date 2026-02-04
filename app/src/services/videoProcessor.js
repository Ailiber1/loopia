import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Singleton FFmpeg instance
let ffmpegInstance = null;
let isLoading = false;
let loadPromise = null;

// Interpolation settings
const BRIDGE_DURATION = 0.5; // Duration of the bridge section in seconds
const INTERPOLATION_FPS = 30; // Frame rate for interpolation

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

// Create a seamless loop video with motion interpolation (no transition effects)
export async function createSeamlessLoop(videoFile, targetMinutes, onStageChange, onProgress) {
  const ffmpeg = await getFFmpeg((p) => {
    if (onProgress) onProgress(Math.min(p * 0.1, 10));
  });

  try {
    onStageChange?.('analyzingVideo');
    onProgress?.(10);

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
    onProgress?.(15);

    // Get video duration
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

    const bridgeDuration = Math.min(BRIDGE_DURATION, videoDuration * 0.15);

    // Calculate repeat count
    const targetSeconds = targetMinutes * 60;
    const repeatCount = Math.ceil(targetSeconds / videoDuration);
    const maxRepeats = Math.min(repeatCount, 10);

    onProgress?.(25);

    // Step 1: Extract the last segment (last bridgeDuration seconds)
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

    // Step 2: Extract the first segment (first bridgeDuration seconds)
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

    // Step 3: Concatenate last + first to create bridge source
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

    // Step 4: Apply minterpolate to generate smooth intermediate frames
    // This uses motion estimation to create new frames between end and start
    await ffmpeg.exec([
      '-i', 'bridge_source.mp4',
      '-vf', `minterpolate=fps=${INTERPOLATION_FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-an',
      '-y',
      'bridge_interpolated.mp4'
    ]);

    onProgress?.(55);

    // Step 5: Extract only the middle part (the actual interpolated transition)
    // Skip the first bridgeDuration and take bridgeDuration from middle
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

    // Step 6: Extract main video (without the last bridgeDuration/2 seconds)
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

    // Step 7: Create the seamless loop unit
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

    // Step 8: Repeat for target duration if needed
    if (maxRepeats > 1) {
      let concatList = '';
      for (let i = 0; i < maxRepeats; i++) {
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
      try {
        await ffmpeg.deleteFile(file);
      } catch {
        // Ignore
      }
    }

    onProgress?.(100);
    onStageChange?.('complete');

    const blob = new Blob([outputData], { type: 'video/mp4' });
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error('Video processing error:', error);
    throw error;
  }
}

// Fallback: Simple loop without interpolation (Canvas method)
export async function createSimpleLoop(videoFile, targetMinutes, onStageChange, onProgress) {
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
  onStageChange?.('generatingLoop');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 5000000
  });

  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const targetDuration = Math.min(targetMinutes * 60, duration * 5);
  const loopsNeeded = Math.ceil(targetDuration / duration);
  const actualLoops = Math.min(loopsNeeded, 3);

  onProgress?.(20);

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

    mediaRecorder.start();

    const renderFrame = () => {
      if (recordingComplete) return;
      ctx.drawImage(video, 0, 0, width, height);
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

// Main processing function
export async function processVideo(videoFile, targetMinutes, onStageChange, onProgress) {
  if (isFFmpegSupported()) {
    try {
      return await createSeamlessLoop(videoFile, targetMinutes, onStageChange, onProgress);
    } catch (error) {
      console.warn('FFmpeg processing failed, falling back to simple method:', error);
      return await createSimpleLoop(videoFile, targetMinutes, onStageChange, onProgress);
    }
  } else {
    console.log('SharedArrayBuffer not available, using simple method');
    return await createSimpleLoop(videoFile, targetMinutes, onStageChange, onProgress);
  }
}
