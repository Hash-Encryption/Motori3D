# Development Status — Phase 02 Completion

## Working

- **360 Spin Viewer Quality & Responsiveness**:
  - Distance-prioritized asynchronous preloading (`Image.decode()`) around the active viewing angle with bounded concurrency.
  - Off-DOM image memory caching preventing DOM layout thrashing, layout shifts, and broken-frame flickers.
  - Multi-pointer direct drag, touch swipe, keyboard arrow navigation, and auto-rotation with seamless 360° forward and reverse wrapping.
  - Immediate `touch-action: pan-y` gesture isolation ensuring smooth mobile horizontal vehicle rotation while preserving vertical document scrollability.
- **Sequence-Reset & Stale State Protection**:
  - Stable `sequenceKey` and `captureId` tracking preventing spurious frame resets during parent re-renders while guaranteeing atomic resets on actual capture switching.
  - Sequence generation counter (`sequenceGenRef`) invalidating in-flight async image decodes from previous captures to prevent stale cache pollution.
  - Out-of-bounds frame protection with `wrapFrameIndex` ensuring switching from higher frame counts (e.g., 72 frames) to lower frame counts (e.g., 36 frames) never results in undefined frame index accesses or broken image URLs.
- **Pipeline & Default Configuration**:
  - Established **48 frames** as the recommended MVP default frame count across upload UI and API fallback handlers.
  - Full backward-compatible runtime support preserved for 36, 48, and 72 frame sequences.
  - Preserved 100% local architecture: Node.js SQLite with WAL mode, local filesystem storage, zero cloud dependencies.

## Baseline

Measurements conducted on real vehicle source video (`IMG_0522.mov`, 38.77s HEVC 3840×2160):

| Target Count | Full Frame Bytes (1600×900 WebP) | Full Frame Payload | Avg Frame Bytes | Thumbnail Bytes (320×180 WebP) | Combined Total Payload | Rotational Step Angle |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **36 frames** | 3,792,284 bytes | 3.792 MB (3.617 MiB) | 105,341 bytes (105.34 KB) | 282,976 bytes (276.34 KiB) | 4,075,260 bytes (4.075 MB / 3.886 MiB) | 10.0° / frame |
| **48 frames** | 5,077,584 bytes | 5.078 MB (4.842 MiB) | 105,783 bytes (105.78 KB) | 377,824 bytes (368.97 KiB) | 5,455,408 bytes (5.455 MB / 5.203 MiB) | 7.5° / frame |
| **72 frames** | 7,601,804 bytes | 7.602 MB (7.250 MiB) | 105,581 bytes (105.58 KB) | 566,780 bytes (553.50 KiB) | 8,168,584 bytes (8.169 MB / 7.790 MiB) | 5.0° / frame |

## Changed

- [`src/lib/spin/frame-utils.ts`](file:///c:/codexprojects/vehicle-360/src/lib/spin/frame-utils.ts): Exported `DEFAULT_FRAME_COUNT = 48` and enhanced `buildPreloadOrder(frameCount, startFrame = 0)` to support dynamic distance-prioritized preloading relative to an arbitrary active angle.
- [`src/components/spin-viewer.tsx`](file:///c:/codexprojects/vehicle-360/src/components/spin-viewer.tsx): Integrated sequence generation counter, `Image.decode()` asynchronous preloading pipeline, dynamic distance-prioritized batch scheduling, safe state adjustments on capture changes, and pointer capture safety.
- [`src/app/vehicles/[id]/viewer/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/vehicles/[id]/viewer/page.tsx): Passed `captureId` to `SpinViewer` to guarantee stable capture identity.
- [`src/components/video-upload-form.tsx`](file:///c:/codexprojects/vehicle-360/src/components/video-upload-form.tsx): Updated default frame count selection to `48` (balanced default).
- [`src/app/api/vehicles/[id]/captures/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/vehicles/[id]/captures/route.ts): Updated fallback target frame count header parsing to `48`.
- [`src/lib/spin/frame-utils.test.ts`](file:///c:/codexprojects/vehicle-360/src/lib/spin/frame-utils.test.ts): Added tests for default frame count and dynamic start-frame preloading.
- [`src/lib/spin/viewer-behavior.test.ts`](file:///c:/codexprojects/vehicle-360/src/lib/spin/viewer-behavior.test.ts): Added test suite covering sequence key stability, capture switching safety (72→36), fast-drag stress, and wraparound bounds.

## Performance / Quality Results

- **Image Quality**: 1600×900 WebP (quality=84) preserves crisp vehicle body reflections, badges, headlight contours, and tire tread details with no perceptible compression banding.
- **Real-Browser Acceptance**: Validated using Headless Google Chrome driven via Chrome DevTools Protocol (CDP) against the local Next.js production build (`http://localhost:3006`) with real vehicle sequences. No new code changes were required by the runtime acceptance pass.
- **Initial Load & Prioritization**: In the local production-build browser test environment, the initial frame (angle 0) rendered promptly upon page load (`1600 × 900`). The viewer was immediately interactive while background preloading (`Image.decode()`) populated remaining angles asynchronously without blocking the main thread.
- **Mobile Viewport Usability (375×667)**: `touch-action: pan-y` isolated horizontal spin gestures while preserving native vertical document scrolling. All control buttons maintained a 48px minimum touch target height and were touch-usable.
- **Fast Drag & Wrapping**: Multi-revolution forward and reverse rapid dragging across boundary wraps produced zero `undefined` frame image requests, zero blank frames, and clean pointer capture release.
- **Capture Switching**: Transitioning between 72-frame (positioned at frame 51) and 36-frame sequences immediately canceled in-flight async decodes, reset active and loaded frame counts atomically, and eliminated stale image flashes or out-of-bounds requests.

## Recommended Frame Count

- **Recommended Default**: **48 frames**
- **Reasoning**: Delivers a fluid 7.5° step resolution that eliminates visible angular stepping for walkaround presentations while reducing total sequence payload by 33.2% compared to 72 frames (5.08 MB vs 7.60 MB).
- **Tradeoffs**:
  - 36 frames (3.79 MB, 10.0°/frame): Smallest payload, but exhibits noticeable stepping when rotating slowly.
  - 48 frames (5.08 MB, 7.5°/frame): Optimal sweet spot for showroom-quality presentation and fast network delivery.
  - 72 frames (7.60 MB, 5.0°/frame): Ultra-smooth rotation, retained for high-bandwidth or desktop showroom kiosks where data payload is secondary.

## Known Limitations

- Multi-resolution adaptive responsive image delivery (srcset/AVIF) and CDN distribution are deferred.
- Background removal, vehicle segmentation, and optical-flow stabilization are deferred.
- Remote authentication, tenant management, and Supabase integration are deferred.

## Next Phase

The next phase will be supplied by the ChatGPT orchestrator.
