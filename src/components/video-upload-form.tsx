"use client";

import { useRouter } from "next/navigation";
import { type DragEvent, type FormEvent, useRef, useState } from "react";

import { extractFramesFromVideo } from "@/lib/video/client-frame-extractor";
import { uploadSpinAssetToCloud } from "@/lib/storage/cloud-spin-uploader";

type VideoUploadFormProps = {
  vehicleId: string;
  businessId?: string | null;
};

export function VideoUploadForm({ vehicleId, businessId }: VideoUploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFrameCount, setTargetFrameCount] = useState("48");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStage, setProcessStage] = useState<
    "EXTRACTING" | "UPLOADING" | "READY" | null
  >(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleFileSelection(file: File | undefined | null) {
    if (!file) return;
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["mp4", "mov"].includes(ext ?? "") && !file.type.includes("video")) {
      setError("Please select an MP4 or MOV video file.");
      return;
    }

    setSelectedFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  }

  function handleCancel() {
    cancelRef.current = true;
    setIsProcessing(false);
    setProcessStage(null);
    setProgressPercent(0);
    setError("Processing was cancelled.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancelRef.current = false;

    const file = selectedFile || fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Select an MP4 or MOV walkaround video.");
      return;
    }

    const framesCount = Number(targetFrameCount) || 48;

    setIsProcessing(true);
    setError(null);
    setProcessStage("EXTRACTING");
    setProgressPercent(0);
    setStatusMessage("Decoding walkaround video & extracting 360 frames...");

    try {
      // Step 1: In-Browser Hardware-Accelerated Frame Extraction
      const asset = await extractFramesFromVideo(
        file,
        framesCount,
        (progress) => {
          if (cancelRef.current) return;
          setProgressPercent(Math.round(progress.percent * 0.6)); // 0% to 60%
          setStatusMessage(
            `Extracting sharp WebP 360 frames... (${progress.currentFrame}/${progress.totalFrames})`,
          );
        },
      );

      if (cancelRef.current) return;

      // Step 2: Direct-to-Cloud Upload to Supabase Storage
      setProcessStage("UPLOADING");
      setStatusMessage("Uploading 360 frame asset to Global Cloud Storage...");

      await uploadSpinAssetToCloud({
        businessId: businessId || undefined,
        vehicleId,
        asset,
        filename: file.name,
        onProgress: (uploadProgress) => {
          if (cancelRef.current) return;
          const currentTotal = 60 + Math.round(uploadProgress.percent * 0.4); // 60% to 100%
          setProgressPercent(currentTotal);
          if (uploadProgress.phase === "SAVING_METADATA") {
            setStatusMessage("Publishing 360 turntable to dealership catalog...");
          } else {
            setStatusMessage(
              `Uploading frames to CDN... (${uploadProgress.uploadedFrames}/${uploadProgress.totalFrames})`,
            );
          }
        },
      });

      if (cancelRef.current) return;

      setProcessStage("READY");
      setStatusMessage("360 turntable ready!");
      setProgressPercent(100);

      // Navigate straight to 360 Viewer with full document reload
      window.location.href = `/vehicles/${vehicleId}/viewer`;
    } catch (err) {
      if (!cancelRef.current) {
        console.error("360 processing error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during 360 video processing.",
        );
      }
    } finally {
      if (!cancelRef.current) {
        setIsProcessing(false);
      }
    }
  }

  function formatMb(bytes: number) {
    return (bytes / 1024 / 1024).toFixed(1);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="capture-error" role="alert">
          <strong>Notice</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="upload-field">
        <label
          className={`upload-dropzone transition-all cursor-pointer ${
            isDragging
              ? "border-amber-500 bg-amber-950/20 scale-[1.01]"
              : "hover:border-stone-400"
          }`}
          htmlFor="walkaround-video"
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="upload-icon" aria-hidden="true">
            {selectedFile ? "✓" : "↑"}
          </span>
          <strong>
            {selectedFile ? selectedFile.name : "Choose or drag & drop walkaround video"}
          </strong>
          <span>
            {selectedFile
              ? `${formatMb(selectedFile.size)} MB · Ready to process`
              : "MP4 or MOV · one complete 360 circle around the car"}
          </span>
        </label>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          id="walkaround-video"
          name="video"
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          disabled={isProcessing}
          onChange={(event) => handleFileSelection(event.target.files?.[0])}
        />
      </div>

      {/* Live 360 Processing & Upload Progress Bar */}
      {isProcessing && (
        <div className="progress-block my-4 p-4 bg-stone-900 border border-stone-800 rounded-xl" aria-live="polite">
          <div className="flex justify-between items-center text-sm font-semibold mb-2">
            <span className="text-amber-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {statusMessage}
            </span>
            <span className="font-mono text-white">{progressPercent}%</span>
          </div>
          <div className="w-full bg-stone-950 rounded-full h-3 overflow-hidden border border-stone-800">
            <div
              className="bg-amber-500 h-full transition-all duration-150 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="field frame-count-field">
        <label htmlFor="targetFrameCount">Spin frame count</label>
        <select
          id="targetFrameCount"
          name="targetFrameCount"
          value={targetFrameCount}
          disabled={isProcessing}
          onChange={(e) => setTargetFrameCount(e.target.value)}
        >
          <option value="36">36 frames · fastest load</option>
          <option value="48">48 frames · balanced (recommended)</option>
          <option value="72">72 frames · ultra smooth</option>
        </select>
      </div>

      <div className="form-actions flex gap-3 items-center mt-6">
        <button
          className="button button-primary"
          type="submit"
          disabled={isProcessing || !selectedFile}
        >
          {isProcessing ? "Processing 360 Spin..." : "Upload & Generate 360 Spin"}
        </button>

        {isProcessing && (
          <button
            type="button"
            onClick={handleCancel}
            className="button button-secondary text-red-400 hover:text-red-300"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
