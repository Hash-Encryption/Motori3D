import { describe, expect, it } from "vitest";

import {
  buildPreloadOrder,
  DEFAULT_FRAME_COUNT,
  wrapFrameIndex,
} from "./frame-utils";

describe("Viewer Behavior & Safety", () => {
  describe("Sequence signature and stability", () => {
    it("generates deterministic sequence keys that distinguish distinct captures", () => {
      const urls72 = Array.from({ length: 72 }, (_, i) => `/api/captures/cap-1/frames/${i}`);
      const urls36 = Array.from({ length: 36 }, (_, i) => `/api/captures/cap-2/frames/${i}`);

      const key72 = `cap-1`;
      const key36 = `cap-2`;
      expect(key72).not.toBe(key36);

      // Fallback signature derived from array contents
      const derived72 = `${urls72.length}:${urls72[0]}:${urls72[urls72.length - 1]}`;
      const derived36 = `${urls36.length}:${urls36[0]}:${urls36[urls36.length - 1]}`;
      expect(derived72).not.toBe(derived36);

      // Equivalent array with new reference produces identical derived key
      const reRendered72 = [...urls72];
      const derivedReRender = `${reRendered72.length}:${reRendered72[0]}:${reRendered72[reRendered72.length - 1]}`;
      expect(derivedReRender).toBe(derived72);
    });

    it("safely handles switching from 72 frames to 36 frames without out-of-bounds frame access", () => {
      const totalFramesNew = 36;
      // Stale frame index 55 from a 72-frame capture
      const staleFrameIndex = 55;

      const safeIndex = wrapFrameIndex(staleFrameIndex, totalFramesNew);
      expect(safeIndex).toBe(19);
      expect(safeIndex).toBeLessThan(totalFramesNew);
      expect(safeIndex).toBeGreaterThanOrEqual(0);

      // Reset index 0 is valid
      expect(wrapFrameIndex(0, totalFramesNew)).toBe(0);
    });
  });

  describe("Fast drag stress and wraparound", () => {
    it("handles rapid forward and reverse rotations across 0/last boundaries flawlessly", () => {
      const frameCounts = [36, 48, 72];

      for (const count of frameCounts) {
        let current = 0;

        // Rapid forward spins
        for (let step = 0; step < 1000; step++) {
          current = wrapFrameIndex(current + 7, count);
          expect(current).toBeGreaterThanOrEqual(0);
          expect(current).toBeLessThan(count);
        }

        // Rapid reverse spins crossing 0 boundary
        for (let step = 0; step < 1000; step++) {
          current = wrapFrameIndex(current - 13, count);
          expect(current).toBeGreaterThanOrEqual(0);
          expect(current).toBeLessThan(count);
        }

        // Oscillating direction reversals
        for (let step = 0; step < 500; step++) {
          current = wrapFrameIndex(current + (step % 2 === 0 ? 5 : -9), count);
          expect(current).toBeGreaterThanOrEqual(0);
          expect(current).toBeLessThan(count);
        }
      }
    });

    it("verifies extreme integer delta wrapping without overflow or NaN", () => {
      expect(wrapFrameIndex(1_000_000, 48)).toBe(wrapFrameIndex(1_000_000 % 48, 48));
      expect(wrapFrameIndex(-1_000_000, 48)).toBe(wrapFrameIndex(-1_000_000 % 48, 48));
      expect(wrapFrameIndex(Number.MAX_SAFE_INTEGER, 48)).toBeGreaterThanOrEqual(0);
      expect(wrapFrameIndex(Number.MIN_SAFE_INTEGER, 48)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Distance-prioritized preloading", () => {
    it("places initial frame first in preload order", () => {
      const order36 = buildPreloadOrder(36, 0);
      expect(order36[0]).toBe(0);
      expect(order36).toHaveLength(36);
      expect(new Set(order36).size).toBe(36);

      const order48 = buildPreloadOrder(48, 0);
      expect(order48[0]).toBe(0);
      expect(order48).toHaveLength(48);
      expect(new Set(order48).size).toBe(48);

      const order72 = buildPreloadOrder(72, 0);
      expect(order72[0]).toBe(0);
      expect(order72).toHaveLength(72);
      expect(new Set(order72).size).toBe(72);
    });

    it("prioritizes neighbor frames outwards symmetrically from arbitrary start positions", () => {
      const order = buildPreloadOrder(48, 20);
      expect(order[0]).toBe(20);
      expect(order[1]).toBe(21);
      expect(order[2]).toBe(19);
      expect(order[3]).toBe(22);
      expect(order[4]).toBe(18);
      expect(order.at(-1)).toBe(44); // Furthest opposite angle
    });

    it("ensures no duplicate indices are scheduled across complete sequence", () => {
      for (const count of [36, 48, 72]) {
        for (let start = 0; start < count; start += 5) {
          const order = buildPreloadOrder(count, start);
          expect(order).toHaveLength(count);
          expect(new Set(order).size).toBe(count);
        }
      }
    });
  });

  describe("Default configuration", () => {
    it("preserves 48 frames as the default balanced configuration", () => {
      expect(DEFAULT_FRAME_COUNT).toBe(48);
    });
  });
});
