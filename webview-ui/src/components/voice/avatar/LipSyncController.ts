export type VisemeLabel = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "X"

export interface PhonemeEntry {
	start: number // seconds
	end: number // seconds
	value: VisemeLabel
}

export type PhonemeTimeline = PhonemeEntry[]

const VALID_VISEMES = new Set<string>(["A", "B", "C", "D", "E", "F", "G", "H", "X"])

export function isVisemeLabel(value: string): value is VisemeLabel {
	return VALID_VISEMES.has(value)
}

/**
 * LipSyncController
 *
 * Maps playback time (in seconds) to a viseme label using binary search
 * over a sorted PhonemeTimeline from RhubarbService.
 *
 * Pure TypeScript — no React dependencies, suitable for unit testing.
 */
export class LipSyncController {
	private readonly timeline: PhonemeTimeline

	constructor(timeline: PhonemeTimeline) {
		this.timeline = timeline
	}

	/**
	 * Returns the viseme active at the given playback time.
	 * Returns "X" if time is before the first entry, after the last entry,
	 * or if the timeline is empty.
	 */
	getVisemeAt(currentTimeSeconds: number): VisemeLabel {
		const { timeline } = this
		if (timeline.length === 0) return "X"

		// Binary search for the entry whose [start, end) range contains currentTimeSeconds
		let lo = 0
		let hi = timeline.length - 1

		while (lo <= hi) {
			const mid = (lo + hi) >>> 1
			const entry = timeline[mid]

			if (currentTimeSeconds < entry.start) {
				hi = mid - 1
			} else if (currentTimeSeconds >= entry.end) {
				lo = mid + 1
			} else {
				// currentTimeSeconds is within [entry.start, entry.end)
				return entry.value
			}
		}

		return "X"
	}

	/** Returns the end time of the last phoneme entry (total audio duration). */
	getDurationSeconds(): number {
		if (this.timeline.length === 0) return 0
		return this.timeline[this.timeline.length - 1].end
	}
}
