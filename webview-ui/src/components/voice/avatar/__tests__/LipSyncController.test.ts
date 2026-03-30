import { describe, expect, it } from "vitest"
import type { PhonemeTimeline } from "../LipSyncController"
import { LipSyncController } from "../LipSyncController"

const timeline: PhonemeTimeline = [
	{ start: 0.0, end: 0.1, value: "A" },
	{ start: 0.1, end: 0.3, value: "B" },
	{ start: 0.3, end: 0.5, value: "C" },
	{ start: 0.5, end: 0.7, value: "D" },
	{ start: 0.7, end: 1.0, value: "X" },
]

describe("LipSyncController", () => {
	describe("getVisemeAt()", () => {
		it("returns first viseme at time 0", () => {
			const ctrl = new LipSyncController(timeline)
			expect(ctrl.getVisemeAt(0)).toBe("A")
		})

		it("returns correct viseme at midpoint of entry", () => {
			const ctrl = new LipSyncController(timeline)
			expect(ctrl.getVisemeAt(0.2)).toBe("B") // midpoint of [0.1, 0.3)
			expect(ctrl.getVisemeAt(0.4)).toBe("C") // midpoint of [0.3, 0.5)
		})

		it("at exactly the boundary returns the NEXT entry", () => {
			const ctrl = new LipSyncController(timeline)
			expect(ctrl.getVisemeAt(0.1)).toBe("B") // boundary between A and B → B
			expect(ctrl.getVisemeAt(0.3)).toBe("C") // boundary between B and C → C
		})

		it("returns X for time before the first entry (negative time)", () => {
			const ctrl = new LipSyncController(timeline)
			expect(ctrl.getVisemeAt(-0.1)).toBe("X")
		})

		it("returns X for time after the last entry ends", () => {
			const ctrl = new LipSyncController(timeline)
			expect(ctrl.getVisemeAt(1.0)).toBe("X") // 1.0 is the end of last entry
			expect(ctrl.getVisemeAt(1.5)).toBe("X")
		})

		it("returns X for empty timeline", () => {
			const ctrl = new LipSyncController([])
			expect(ctrl.getVisemeAt(0)).toBe("X")
			expect(ctrl.getVisemeAt(0.5)).toBe("X")
		})

		it("returns X for single-entry timeline when time is outside the entry", () => {
			const ctrl = new LipSyncController([{ start: 0.2, end: 0.4, value: "B" }])
			expect(ctrl.getVisemeAt(0.1)).toBe("X")
			expect(ctrl.getVisemeAt(0.4)).toBe("X")
		})
	})

	describe("getDurationSeconds()", () => {
		it("returns end time of the last entry", () => {
			const ctrl = new LipSyncController(timeline)
			expect(ctrl.getDurationSeconds()).toBe(1.0)
		})

		it("returns 0 for empty timeline", () => {
			const ctrl = new LipSyncController([])
			expect(ctrl.getDurationSeconds()).toBe(0)
		})
	})

	describe("performance", () => {
		it("binary search on 1000-entry timeline completes in under 1ms", () => {
			const bigTimeline: PhonemeTimeline = Array.from({ length: 1000 }, (_, i) => ({
				start: i * 0.01,
				end: (i + 1) * 0.01,
				value: ["A", "B", "C", "D", "E", "F", "G", "H", "X"][i % 9] as PhonemeTimeline[0]["value"],
			}))
			const ctrl = new LipSyncController(bigTimeline)

			const start = performance.now()
			for (let i = 0; i < 100; i++) {
				ctrl.getVisemeAt(Math.random() * 10)
			}
			const elapsed = performance.now() - start

			// 100 lookups in under 10ms (100x margin from 1ms target)
			expect(elapsed).toBeLessThan(10)
		})
	})
})
