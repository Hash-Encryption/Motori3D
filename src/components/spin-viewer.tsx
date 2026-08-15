"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { buildPreloadOrder, wrapFrameIndex } from "@/lib/spin/frame-utils";

type SpinViewerProps = {
  vehicleName: string;
  frameUrls: string[];
  width: number;
  height: number;
  pixelsPerFrame?: number;
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
  pixelsPerFrame = 10,
}: SpinViewerProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const currentFrameRef = useRef(0);
  const pendingFrameRef = useRef(0);
  const frameRequestRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const loadedFramesRef = useRef(new Set<number>());

  const commitFrame = useCallback(
    (nextFrame: number) => {
      const wrapped = wrapFrameIndex(nextFrame, frameUrls.length);
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

  useEffect(() => {
    const loaded = loadedFramesRef.current;
    loaded.clear();
    let cancelled = false;
    let preloadTimer: number | null = null;
    const cachedImages: HTMLImageElement[] = [];
    const preloadOrder = buildPreloadOrder(frameUrls.length);
    let nextPreload = 0;

    function preloadBatch() {
      const batchSize = nextPreload === 0 ? 6 : 4;
      const batchEnd = Math.min(nextPreload + batchSize, preloadOrder.length);
      for (; nextPreload < batchEnd; nextPreload += 1) {
        const index = preloadOrder[nextPreload];
        const image = new Image();
        cachedImages.push(image);
        image.decoding = "async";
        image.onload = () => {
          if (cancelled || loaded.has(index)) return;
          loaded.add(index);
          setLoadedCount(loaded.size);
        };
        image.src = frameUrls[index];
      }

      if (nextPreload < preloadOrder.length) {
        preloadTimer = window.setTimeout(preloadBatch, 70);
      }
    }
    preloadBatch();

    return () => {
      cancelled = true;
      if (preloadTimer !== null) window.clearTimeout(preloadTimer);
      for (const image of cachedImages) image.onload = null;
    };
  }, [frameUrls]);

  useEffect(() => {
    if (!isAutoplaying) return;
    const interval = window.setInterval(() => {
      commitFrame(currentFrameRef.current + 1);
    }, 110);
    return () => window.clearInterval(interval);
  }, [commitFrame, isAutoplaying]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === viewerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRequestRef.current !== null) {
        window.cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, []);

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
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.accumulatedX += deltaX;

    if (Math.abs(event.clientX - drag.startX) < 4) return;
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
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
    } else {
      await document.exitFullscreen();
    }
  }

  function resetView() {
    setIsAutoplaying(false);
    commitFrame(0);
  }

  const readyThreshold = Math.min(6, frameUrls.length);
  const enoughFramesLoaded = loadedCount >= readyThreshold;

  return (
    <div className="spin-viewer" ref={viewerRef}>
      <div
        className={`spin-stage ${isDragging ? "is-dragging" : ""}`}
        role="application"
        aria-label={`${vehicleName} 360 degree viewer`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerInteraction}
        onPointerCancel={endPointerInteraction}
      >
        {/* Only this current image is rendered; all other frames are cached off-DOM. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- direct URL swapping is the core image-sequence viewer behavior */}
        <img
          src={frameUrls[currentFrame]}
          alt={`${vehicleName}, angle ${currentFrame + 1} of ${frameUrls.length}`}
          width={width}
          height={height}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        />
        {!enoughFramesLoaded ? (
          <div className="spin-loading" role="status">
            Preparing spin · {loadedCount}/{readyThreshold}
          </div>
        ) : null}
        <div className="drag-hint" aria-hidden="true">← Drag to rotate →</div>
      </div>

      <div className="spin-readout" aria-live="polite">
        <span>Frame {currentFrame + 1} / {frameUrls.length}</span>
        <span>{loadedCount === frameUrls.length ? "All frames loaded" : `${loadedCount} loaded`}</span>
      </div>

      <div className="spin-controls" aria-label="360 viewer controls">
        <button type="button" onClick={() => { setIsAutoplaying(false); commitFrame(currentFrameRef.current - 1); }}>
          ← Previous
        </button>
        <button type="button" onClick={() => setIsAutoplaying((value) => !value)}>
          {isAutoplaying ? "Pause" : "Auto rotate"}
        </button>
        <button type="button" onClick={() => { setIsAutoplaying(false); commitFrame(currentFrameRef.current + 1); }}>
          Next →
        </button>
        <button type="button" onClick={resetView}>Front view</button>
        <button type="button" onClick={toggleFullscreen}>
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
    </div>
  );
}
