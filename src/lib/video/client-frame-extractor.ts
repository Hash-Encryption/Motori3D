/**
 * Client-Side In-Browser Video 360 Frame Extractor
 * Extracts sharp, lightweight WebP 360 spin frames directly on the client GPU/CPU
 * without requiring any backend server computing or cloud encoding costs.
 */

export type ExtractionProgress = {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  stage: "LOADING" | "EXTRACTING" | "FINALIZING";
};

export type ExtractedSpinAsset = {
  frames: Blob[];
  metadata: {
    width: number;
    height: number;
    durationSeconds: number;
    fps: number;
    targetFrameCount: number;
    totalSizeBytes: number;
  };
};

export async function extractFramesFromVideo(
  file: File,
  targetFrameCount: number = 48,
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ExtractedSpinAsset> {
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

    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to create 2D rendering canvas in browser."));
      return;
    }

    onProgress?.({
      currentFrame: 0,
      totalFrames: targetFrameCount,
      percent: 0,
      stage: "LOADING",
    });

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Browser could not decode the selected video file."));
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        if (!duration || duration <= 0 || !Number.isFinite(duration)) {
          throw new Error("Invalid video duration.");
        }

        // Maintain aspect ratio with max dimension of 1920 for crisp mobile & desktop rendering
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

        const frames: Blob[] = [];
        let totalSizeBytes = 0;

        // Calculate step interval across duration
        const step = duration / targetFrameCount;

        for (let i = 0; i < targetFrameCount; i++) {
          const seekTime = Math.min(i * step, duration - 0.05);

          // Seek to timestamp
          await new Promise<void>((seekResolve, seekReject) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              seekResolve();
            };
            const onSeekError = () => {
              video.removeEventListener("error", onSeekError);
              seekReject(new Error(`Failed seeking to frame ${i} at ${seekTime.toFixed(2)}s`));
            };

            video.addEventListener("seeked", onSeeked, { once: true });
            video.addEventListener("error", onSeekError, { once: true });
            video.currentTime = seekTime;
          });

          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, renderWidth, renderHeight);

          // Export as high-quality, lightweight WebP blob
          const blob = await new Promise<Blob | null>((blobResolve) => {
            canvas.toBlob(blobResolve, "image/webp", 0.85);
          });

          if (!blob) {
            throw new Error(`Failed to encode WebP frame ${i}`);
          }

          frames.push(blob);
          totalSizeBytes += blob.size;

          onProgress?.({
            currentFrame: i + 1,
            totalFrames: targetFrameCount,
            percent: Math.round(((i + 1) / targetFrameCount) * 100),
            stage: "EXTRACTING",
          });
        }

        onProgress?.({
          currentFrame: targetFrameCount,
          totalFrames: targetFrameCount,
          percent: 100,
          stage: "FINALIZING",
        });

        URL.revokeObjectURL(objectUrl);

        resolve({
          frames,
          metadata: {
            width: renderWidth,
            height: renderHeight,
            durationSeconds: duration,
            fps: Math.round((targetFrameCount / duration) * 10) / 10,
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
