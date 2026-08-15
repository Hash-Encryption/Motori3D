/**
 * Client-Side In-Browser Video 360 Frame Extractor & Seamless Loop Closure Engine
 * Extracts sharp, lightweight WebP 360 spin frames directly on the client GPU/CPU
 * and automatically aligns the 360 loop closure so Frame 47 seamlessly wraps into Frame 0.
 */

export type ExtractionProgress = {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  stage: "LOADING" | "DETECTING_LOOP" | "EXTRACTING" | "FINALIZING";
  statusText?: string;
};

export type ExtractedSpinAsset = {
  frames: Blob[];
  metadata: {
    width: number;
    height: number;
    durationSeconds: number;
    loopStartTime: number;
    loopEndTime: number;
    fps: number;
    targetFrameCount: number;
    totalSizeBytes: number;
  };
};

export type ExtractionOptions = {
  targetFrameCount?: number;
  autoDetectLoop?: boolean;
  startTime?: number;
  endTime?: number;
};

/**
 * Computes mean absolute pixel difference between two ImageData buffers.
 */
function computeFrameDifference(a: ImageData, b: ImageData): number {
  const dataA = a.data;
  const dataB = b.data;
  let diff = 0;
  const len = dataA.length;

  for (let i = 0; i < len; i += 4) {
    diff += Math.abs(dataA[i] - dataB[i]) + // R
            Math.abs(dataA[i + 1] - dataB[i + 1]) + // G
            Math.abs(dataA[i + 2] - dataB[i + 2]); // B
  }

  return diff / (len / 4 * 3);
}

export async function extractFramesFromVideo(
  file: File,
  options: number | ExtractionOptions = 48,
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ExtractedSpinAsset> {
  const config: ExtractionOptions =
    typeof options === "number"
      ? { targetFrameCount: options, autoDetectLoop: true }
      : { targetFrameCount: 48, autoDetectLoop: true, ...options };

  const targetFrameCount = config.targetFrameCount || 48;
  const autoDetectLoop = config.autoDetectLoop ?? true;

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Small canvas for fast visual similarity analysis
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 64;
    thumbCanvas.height = 36;
    const thumbCtx = thumbCanvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || !thumbCtx) {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to create 2D rendering canvas in browser."));
      return;
    }

    onProgress?.({
      currentFrame: 0,
      totalFrames: targetFrameCount,
      percent: 0,
      stage: "LOADING",
      statusText: "Loading video into browser memory...",
    });

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Browser could not decode the selected video file."));
    };

    async function seekVideo(targetTime: number): Promise<void> {
      return new Promise<void>((seekResolve, seekReject) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          seekResolve();
        };
        const onSeekError = () => {
          video.removeEventListener("error", onSeekError);
          seekReject(new Error(`Failed seeking to timestamp ${targetTime.toFixed(2)}s`));
        };

        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onSeekError, { once: true });
        video.currentTime = Math.max(0, Math.min(targetTime, video.duration - 0.05));
      });
    }

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        if (!duration || duration <= 0 || !Number.isFinite(duration)) {
          throw new Error("Invalid video duration.");
        }

        // Set optimal 1920 max resolution
        const sourceWidth = video.videoWidth || 1920;
        const sourceHeight = video.videoHeight || 1080;
        const maxDimension = 1920;

        let renderWidth = sourceWidth;
        let renderHeight = sourceHeight;

        if (sourceWidth > maxDimension || sourceHeight > maxDimension) {
          if (sourceWidth >= sourceHeight) {
            renderWidth = maxDimension;
            renderHeight = Math.round((sourceHeight / sourceWidth) * maxDimension);
          } else {
            renderHeight = maxDimension;
            renderWidth = Math.round((sourceWidth / sourceHeight) * maxDimension);
          }
        }

        canvas.width = renderWidth;
        canvas.height = renderHeight;

        let startTime = config.startTime ?? Math.min(0.3, duration * 0.02);
        let endTime = config.endTime ?? (duration - 0.2);

        // Phase 1: Automatic 360 Loop-Closure Detection
        if (autoDetectLoop && duration > 4.0 && !config.endTime) {
          onProgress?.({
            currentFrame: 0,
            totalFrames: targetFrameCount,
            percent: 5,
            stage: "DETECTING_LOOP",
            statusText: "Analyzing 360 loop closure & aligning starting angle...",
          });

          // Grab start frame thumbnail
          await seekVideo(startTime);
          thumbCtx.drawImage(video, 0, 0, 64, 36);
          const startFrameData = thumbCtx.getImageData(0, 0, 64, 36);

          // Search in the 65% - 98% duration window for the exact 360 circle match
          const searchStart = Math.max(startTime + 3.0, duration * 0.65);
          const searchEnd = Math.max(searchStart + 0.5, duration - 0.2);
          const searchStep = Math.max(0.12, (searchEnd - searchStart) / 40);

          let bestDiff = Infinity;
          let bestTimestamp = searchEnd;

          for (let t = searchStart; t <= searchEnd; t += searchStep) {
            await seekVideo(t);
            thumbCtx.drawImage(video, 0, 0, 64, 36);
            const candidateData = thumbCtx.getImageData(0, 0, 64, 36);
            const diff = computeFrameDifference(startFrameData, candidateData);

            if (diff < bestDiff) {
              bestDiff = diff;
              bestTimestamp = t;
            }
          }

          // Fine search around best timestamp (+/- 0.3s)
          const fineStart = Math.max(searchStart, bestTimestamp - 0.3);
          const fineEnd = Math.min(searchEnd, bestTimestamp + 0.3);
          for (let t = fineStart; t <= fineEnd; t += 0.04) {
            await seekVideo(t);
            thumbCtx.drawImage(video, 0, 0, 64, 36);
            const candidateData = thumbCtx.getImageData(0, 0, 64, 36);
            const diff = computeFrameDifference(startFrameData, candidateData);

            if (diff < bestDiff) {
              bestDiff = diff;
              bestTimestamp = t;
            }
          }

          endTime = bestTimestamp;
        }

        // Phase 2: Sample exactly targetFrameCount equidistant frames across [startTime, endTime)
        const loopDuration = Math.max(0.1, endTime - startTime);
        const step = loopDuration / targetFrameCount;

        const frames: Blob[] = [];
        let totalSizeBytes = 0;

        for (let i = 0; i < targetFrameCount; i++) {
          const seekTime = startTime + (i * step);

          await seekVideo(seekTime);

          // Draw high-res frame to canvas
          ctx.drawImage(video, 0, 0, renderWidth, renderHeight);

          // Export as crisp, optimized WebP
          const blob = await new Promise<Blob | null>((blobResolve) => {
            canvas.toBlob(blobResolve, "image/webp", 0.85);
          });

          if (!blob) {
            throw new Error(`Failed to encode WebP frame ${i}`);
          }

          frames.push(blob);
          totalSizeBytes += blob.size;

          const progressPercent = Math.round(15 + ((i + 1) / targetFrameCount) * 85);
          onProgress?.({
            currentFrame: i + 1,
            totalFrames: targetFrameCount,
            percent: progressPercent,
            stage: "EXTRACTING",
            statusText: `Extracting 360 turntable frames... (${i + 1}/${targetFrameCount})`,
          });
        }

        onProgress?.({
          currentFrame: targetFrameCount,
          totalFrames: targetFrameCount,
          percent: 100,
          stage: "FINALIZING",
          statusText: "Finalizing 360 spin asset...",
        });

        URL.revokeObjectURL(objectUrl);

        resolve({
          frames,
          metadata: {
            width: renderWidth,
            height: renderHeight,
            durationSeconds: duration,
            loopStartTime: startTime,
            loopEndTime: endTime,
            fps: Math.round((targetFrameCount / loopDuration) * 10) / 10,
            targetFrameCount,
            totalSizeBytes,
          },
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
  });
}
