"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { wrapFrameIndex } from "@/lib/spin/frame-utils";

type SpinViewerProps = {
  vehicleName: string;
  frameUrls: string[];
  width: number;
  height: number;
  pixelsPerFrame?: number;
  captureId?: string;
};

type DragState = {
  pointerId: number;
  startX: number;
  lastX: number;
  accumulatedX: number;
};

export function SpinViewer({
  vehicleName,
  frameUrls,
  width,
  height,
  pixelsPerFrame = 8,
  captureId,
}: SpinViewerProps) {
  const sequenceKey =
    captureId ?? `${frameUrls.length}:${frameUrls[0] ?? ""}:${frameUrls[frameUrls.length - 1] ?? ""}`;

  const [prevSequenceKey, setPrevSequenceKey] = useState(sequenceKey);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (prevSequenceKey !== sequenceKey) {
    setPrevSequenceKey(sequenceKey);
    setCurrentFrame(0);
    setLoadedCount(0);
    setIsAutoplaying(false);
    setIsDragging(false);
  }

  const viewerRef = useRef<HTMLDivElement>(null);
  const currentFrameRef = useRef(0);
  const pendingFrameRef = useRef(0);
  const frameRequestRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const loadedFramesRef = useRef(new Set<number>());
  const sequenceGenRef = useRef(0);
  const cachedImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());

  const commitFrame = useCallback(
    (nextFrame: number) => {
      const total = frameUrls.length || 1;
      const wrapped = wrapFrameIndex(nextFrame, total);
      currentFrameRef.current = wrapped;
      pendingFrameRef.current = wrapped;

      if (frameRequestRef.current === null) {
        frameRequestRef.current = window.requestAnimationFrame(() => {
          setCurrentFrame(pendingFrameRef.current);
          frameRequestRef.current = null;
        });
      }
    },
    [frameUrls.length],
  );

  // Fast Parallel Preloading Pipeline
  useEffect(() => {
    sequenceGenRef.current += 1;
    const currentGen = sequenceGenRef.current;

    currentFrameRef.current = 0;
    pendingFrameRef.current = 0;
    dragRef.current = null;
    loadedFramesRef.current.clear();
    cachedImagesRef.current.clear();

    if (frameUrls.length === 0) return;

    let cancelled = false;
    const loaded = loadedFramesRef.current;
    const cachedImages = cachedImagesRef.current;

    async function loadFrame(index: number): Promise<void> {
      if (cancelled || currentGen !== sequenceGenRef.current) return;
      if (loaded.has(index)) return;

      const img = new Image();
      cachedImages.set(index, img);
      img.decoding = "async";
      img.src = frameUrls[index];

      try {
        if ("decode" in img && typeof img.decode === "function") {
          await img.decode();
        } else {
          await new Promise<void>((resolve) => {
            img.onload = img.onerror = () => resolve();
          });
        }
      } catch {
        // Ignored non-fatal decode error
      }

      if (cancelled || currentGen !== sequenceGenRef.current) return;

      if (!loaded.has(index)) {
        loaded.add(index);
        setLoadedCount(loaded.size);
      }
    }

    // Load in fast concurrent waves of 12 frames
    async function loadAllFrames() {
      const total = frameUrls.length;
      const concurrency = 12;

      for (let i = 0; i < total; i += concurrency) {
        if (cancelled || currentGen !== sequenceGenRef.current) break;
        const chunk = [];
        for (let j = i; j < Math.min(i + concurrency, total); j++) {
          chunk.push(loadFrame(j));
        }
        await Promise.all(chunk);
      }
    }

    loadAllFrames();

    return () => {
      cancelled = true;
      for (const img of cachedImages.values()) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [sequenceKey, frameUrls]);

  // Smooth Auto-Rotation Loop
  useEffect(() => {
    if (!isAutoplaying) return;
    const interval = window.setInterval(() => {
      commitFrame(currentFrameRef.current + 1);
    }, 60);

    return () => window.clearInterval(interval);
  }, [isAutoplaying, commitFrame]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    setIsAutoplaying(false);
    setIsDragging(true);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      accumulatedX: 0,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Defensive fallback
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.accumulatedX += deltaX;

    if (Math.abs(drag.accumulatedX) >= pixelsPerFrame) {
      const frameDelta = Math.trunc(drag.accumulatedX / pixelsPerFrame);
      drag.accumulatedX -= frameDelta * pixelsPerFrame;
      commitFrame(currentFrameRef.current - frameDelta);
    }
  }

  function endPointerInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Defensive fallback
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIsAutoplaying(false);
      commitFrame(currentFrameRef.current - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setIsAutoplaying(false);
      commitFrame(currentFrameRef.current + 1);
    }
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await viewerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  function resetView() {
    setIsAutoplaying(false);
    commitFrame(0);
  }

  const safeFrameIndex = wrapFrameIndex(currentFrame, frameUrls.length || 1);
  const activeFrameUrl = frameUrls[safeFrameIndex] ?? frameUrls[0] ?? "";
  const isFullyLoaded = loadedCount === frameUrls.length;

  return (
    <div className="spin-viewer" ref={viewerRef}>
      <div
        className={`spin-stage select-none ${isDragging ? "is-dragging cursor-grabbing" : "cursor-grab"}`}
        role="application"
        aria-label={`${vehicleName} 360 degree viewer`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerInteraction}
        onPointerCancel={endPointerInteraction}
      >
        {activeFrameUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeFrameUrl}
            alt={`${vehicleName}, angle ${safeFrameIndex + 1} of ${frameUrls.length}`}
            width={width}
            height={height}
            draggable={false}
            className="w-full h-auto object-contain pointer-events-none select-none transition-none"
            onDragStart={(event) => event.preventDefault()}
          />
        ) : null}

        {!isFullyLoaded && frameUrls.length > 0 && (
          <div className="spin-loading absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold text-amber-400 flex items-center gap-2 border border-white/10" role="status">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Buffering 60 FPS · {loadedCount}/{frameUrls.length}
          </div>
        )}

        <div className="drag-hint select-none" aria-hidden="true">
          ↔ Drag horizontally to rotate 360°
        </div>
      </div>

      <div className="spin-readout flex justify-between items-center px-2 py-1 text-xs text-stone-400" aria-live="polite">
        <span className="font-mono">Frame {safeFrameIndex + 1} of {frameUrls.length}</span>
        <span>{isFullyLoaded ? "⚡ 60 FPS Cached" : `Caching (${Math.round((loadedCount / (frameUrls.length || 1)) * 100)}%)`}</span>
      </div>

      <div className="spin-controls flex flex-wrap gap-2 justify-center mt-3" aria-label="360 viewer controls">
        <button
          type="button"
          className="button button-secondary text-sm px-3 py-1.5"
          onClick={() => { setIsAutoplaying(false); commitFrame(currentFrameRef.current - 1); }}
        >
          ← Previous
        </button>
        <button
          type="button"
          className="button button-primary text-sm px-4 py-1.5"
          onClick={() => setIsAutoplaying((value) => !value)}
        >
          {isAutoplaying ? "⏸ Pause" : "▶ Auto Rotate"}
        </button>
        <button
          type="button"
          className="button button-secondary text-sm px-3 py-1.5"
          onClick={() => { setIsAutoplaying(false); commitFrame(currentFrameRef.current + 1); }}
        >
          Next →
        </button>
        <button
          type="button"
          className="button button-secondary text-sm px-3 py-1.5"
          onClick={resetView}
        >
          Front View
        </button>
        <button
          type="button"
          className="button button-secondary text-sm px-3 py-1.5"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? "Exit Fullscreen" : "⛶ Fullscreen"}
        </button>
      </div>
    </div>
  );
}
