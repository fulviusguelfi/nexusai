import { EventEmitter } from "events"

export interface VoiceStatus {
	isRecording: boolean
	isSpeaking: boolean
	lastTranscription: string
}

type VoiceStatusListener = (status: VoiceStatus) => void
type SpeakListener = (text: string) => void

/**
 * VoiceSessionManager
 *
 * Lightweight singleton that tracks the current voice I/O session state.
 * Components subscribe via `onDidChangeStatus` and receive a new status
 * snapshot whenever recording, speaking, or the transcription changes.
 *
 * Notes:
 * – This intentionally avoids importing vscode so it can be unit-tested
 *   without the VS Code extension host.
 * – Callers within the extension host may wrap the returned disposer
 *   function in a `vscode.Disposable` if needed.
 */
export class VoiceSessionManager {
	private static _instance: VoiceSessionManager | undefined

	private _isRecording = false
	private _isSpeaking = false
	private _lastTranscription = ""

	private readonly _emitter = new EventEmitter()
	private static readonly _EVENT = "statusChange"
	private static readonly _SPEAK_EVENT = "speak"
	private static readonly _TRANSCRIPTION_EVENT = "transcription"

	private constructor() {}

	static getInstance(): VoiceSessionManager {
		if (!VoiceSessionManager._instance) {
			VoiceSessionManager._instance = new VoiceSessionManager()
		}
		return VoiceSessionManager._instance
	}

	// ----- Getters -----

	get isRecording(): boolean {
		return this._isRecording
	}

	get isSpeaking(): boolean {
		return this._isSpeaking
	}

	get lastTranscription(): string {
		return this._lastTranscription
	}

	get status(): VoiceStatus {
		return {
			isRecording: this._isRecording,
			isSpeaking: this._isSpeaking,
			lastTranscription: this._lastTranscription,
		}
	}

	// ----- Setters (each fires a change event) -----

	setRecording(value: boolean): void {
		if (this._isRecording !== value) {
			this._isRecording = value
			this._notify()
		}
	}

	setSpeaking(value: boolean): void {
		if (this._isSpeaking !== value) {
			this._isSpeaking = value
			this._notify()
		}
	}

	setLastTranscription(text: string): void {
		this._lastTranscription = text
		this._notify()
		this._emitter.emit(VoiceSessionManager._TRANSCRIPTION_EVENT, text)
	}

	/**
	 * Request the extension host to synthesize and play the given text.
	 * VscodeWebviewProvider listens to this event and dispatches to PiperService.
	 */
	requestSpeak(text: string): void {
		this._emitter.emit(VoiceSessionManager._SPEAK_EVENT, text)
	}

	/**
	 * Wait for the next transcription result (from voice_float32_audio → whisper).
	 * Resolves with the transcribed text or "" on timeout.
	 */
	waitForTranscription(timeoutMs = 30_000): Promise<string> {
		return new Promise<string>((resolve) => {
			const timer = setTimeout(() => {
				this._emitter.off(VoiceSessionManager._TRANSCRIPTION_EVENT, handler)
				resolve("")
			}, timeoutMs)

			const handler = (text: string) => {
				clearTimeout(timer)
				this._emitter.off(VoiceSessionManager._TRANSCRIPTION_EVENT, handler)
				resolve(text)
			}

			this._emitter.once(VoiceSessionManager._TRANSCRIPTION_EVENT, handler)
		})
	}

	/**
	 * Subscribe to status changes. Returns a disposer function.
	 *
	 * @example
	 *   const dispose = manager.onDidChangeStatus(s => console.log(s))
	 *   // later:
	 *   dispose()
	 */
	onDidChangeStatus(listener: VoiceStatusListener): () => void {
		this._emitter.on(VoiceSessionManager._EVENT, listener)
		return () => this._emitter.off(VoiceSessionManager._EVENT, listener)
	}

	/**
	 * Subscribe to TTS speak requests from tool handlers.
	 * Called by VscodeWebviewProvider to drive audio playback.
	 */
	onSpeakRequest(listener: SpeakListener): () => void {
		this._emitter.on(VoiceSessionManager._SPEAK_EVENT, listener)
		return () => this._emitter.off(VoiceSessionManager._SPEAK_EVENT, listener)
	}

	dispose(): void {
		this._emitter.removeAllListeners()
		VoiceSessionManager._instance = undefined
	}

	private _notify(): void {
		this._emitter.emit(VoiceSessionManager._EVENT, this.status)
	}
}
