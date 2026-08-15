"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { CaptureRecord } from "@/server/captures/capture-repository";

type CaptureProcessingPanelProps = {
  initialCapture: CaptureRecord;
};

const stageLabels = [
  { status: "UPLOADED", label: "Video uploaded" },
  { status: "ANALYZING", label: "Video analyzed" },
  { status: "EXTRACTING", label: "Frames extracted" },
  { status: "PROCESSING_IMAGES", label: "Images processed" },
  { status: "READY", label: "360 viewer ready" },
] as const;

const statusRank = {
  UPLOADED: 0,
  ANALYZING: 1,
  EXTRACTING: 2,
  PROCESSING_IMAGES: 3,
  READY: 4,
  FAILED: -1,
} as const;

export function CaptureProcessingPanel({ initialCapture }: CaptureProcessingPanelProps) {
  const [capture, setCapture] = useState(initialCapture);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pollingRef = useRef<number | null>(null);

  const isProcessing = ["ANALYZING", "EXTRACTING", "PROCESSING_IMAGES"].includes(
    capture.status,
  );

  useEffect(() => {
    if (!isProcessing) return;

    async function poll() {
      try {
        const response = await fetch(`/api/captures/${capture.id}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          capture?: CaptureRecord;
          error?: string;
        };
        if (response.ok && result.capture) {
          setCapture(result.capture);
        }
      } finally {
        pollingRef.current = window.setTimeout(poll, 700);
      }
    }

    pollingRef.current = window.setTimeout(poll, 350);
    return () => {
      if (pollingRef.current !== null) window.clearTimeout(pollingRef.current);
    };
  }, [capture.id, isProcessing]);

  async function startProcessing() {
    setIsStarting(true);
    setRequestError(null);
    try {
      const response = await fetch(`/api/captures/${capture.id}/process`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setRequestError(result.error ?? "Processing could not start.");
        return;
      }
      setCapture((current) => ({
        ...current,
        status: "ANALYZING",
        processingStage: "ANALYZING_VIDEO",
        processingProgress: Math.max(current.processingProgress, 20),
      }));
    } catch {
      setRequestError("The server could not be reached.");
    } finally {
      setIsStarting(false);
    }
  }

  const currentRank = statusRank[capture.status];

  return (
    <>
      {requestError ? <div className="form-error" role="alert">{requestError}</div> : null}
      {capture.status === "FAILED" ? (
        <div className="capture-error" role="alert">
          <strong>Processing failed</strong>
          <span>{capture.error ?? "Review the server log and retry."}</span>
        </div>
      ) : null}

      <ol className="status-list" aria-label="Processing stages">
        {stageLabels.map((stage, index) => {
          const complete =
            capture.status === "READY" ||
            currentRank > index ||
            (capture.status === "UPLOADED" && index === 0);
          const active = currentRank === index && capture.status !== "UPLOADED";
          return (
            <li className={`status-item ${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`} key={stage.status}>
              <span className="status-dot" aria-hidden="true">{complete ? "✓" : ""}</span>
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="progress-block" aria-live="polite">
        <div className="progress-label">
          <span>{capture.processingStage?.replaceAll("_", " ") ?? "Ready to start"}</span>
          <strong>{capture.processingProgress}%</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${capture.processingProgress}%` }} />
        </div>
      </div>

      <div className="form-actions">
        <Link className="button button-secondary" href="/">Back to projects</Link>
        {capture.status === "READY" ? (
          <Link className="button button-primary" href={`/vehicles/${capture.vehicleId}/viewer`}>
            Open 360
          </Link>
        ) : (
          <button
            className="button button-primary"
            type="button"
            onClick={startProcessing}
            disabled={isStarting || isProcessing}
          >
            {isProcessing ? "Processing…" : capture.status === "FAILED" ? "Retry processing" : "Start processing"}
          </button>
        )}
      </div>
    </>
  );
}
