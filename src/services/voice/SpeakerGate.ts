import { EventEmitter } from "events"

type ChangeListener = (blocked: boolean) => void

/**
 * SpeakerGate
 *
 * Singleton that tracks whether TTS audio is currently playing.
 * While active (blocked), incoming STT recording requests must be
 * dropped to prevent the microphone from capturing the AI's own voice.
 *
 * Usage:
 *   SpeakerGate.getInstance().activate()   // before playWavOnHost()
 *   await playWavOnHost(wavBuf)
 *   SpeakerGate.getInstance().deactivate() // after playback ends
 *
 * Notes:
 * – Multiple activate() calls are idempotent — state is boolean, not a counter.
 * – Intentionally avoids importing vscode so it can be unit-tested without
 *   the VS Code extension host.
 */
export class SpeakerGate {
	private static _instance: SpeakerGate | undefined

	private _isBlocked = false
	private _activatedAt = 0
	private readonly _emitter = new EventEmitter()
	private static readonly _EVENT = "change"

	private constructor() {}

	static getInstance(): SpeakerGate {
		if (!SpeakerGate._instance) {
			SpeakerGate._instance = new SpeakerGate()
		}
		return SpeakerGate._instance
	}

	/** Returns true when TTS playback is active and STT should be suppressed. */
	isBlocked(): boolean {
		return this._isBlocked
	}

	/** Call immediately before starting TTS audio playback. */
	activate(): void {
		if (this._isBlocked) return
		this._isBlocked = true
		this._activatedAt = Date.now()
		this._emitter.emit(SpeakerGate._EVENT, true)
	}

	/** Call immediately after TTS audio playback ends. */
	deactivate(): void {
		if (!this._isBlocked) return
		this._isBlocked = false
		this._activatedAt = 0
		this._emitter.emit(SpeakerGate._EVENT, false)
	}

	/** Returns how long (ms) the gate has been blocked. */
	getBlockedDurationMs(): number {
		if (!this._isBlocked || this._activatedAt === 0) return 0
		return Math.max(0, Date.now() - this._activatedAt)
	}

	/**
	 * Best-effort stale-gate recovery.
	 * Returns true if the gate was blocked and got released for exceeding maxMs.
	 */
	releaseIfStale(maxMs: number): boolean {
		if (!this._isBlocked) return false
		if (this.getBlockedDurationMs() < maxMs) return false
		this.deactivate()
		return true
	}

	/**
	 * Subscribe to gate state changes.
	 * The callback receives `true` when the gate opens (TTS starts)
	 * and `false` when it closes (TTS ends).
	 *
	 * @returns A disposer function that removes the listener.
	 */
	onDidChange(listener: ChangeListener): () => void {
		this._emitter.on(SpeakerGate._EVENT, listener)
		return () => this._emitter.off(SpeakerGate._EVENT, listener)
	}

	dispose(): void {
		this._emitter.removeAllListeners()
		SpeakerGate._instance = undefined
	}
}
