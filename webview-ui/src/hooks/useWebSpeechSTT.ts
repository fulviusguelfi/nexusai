/**
 * useWebSpeechSTT — Real-time speech-to-text via the Web Speech API (Chromium/Electron).
 *
 * Uses SpeechRecognition with `interimResults: true` so `interimText` updates continuously
 * while the user speaks. `onFinalTranscript` is called once the browser finalises the segment.
 *
 * If SpeechRecognition is not available in the current context, `isSupported` will be `false`
 * and all controls are no-ops.
 */

import { useCallback, useEffect, useRef, useState } from "react"

// Augment Window with the non-standard webkit prefix used on some Chromium builds.
declare global {
	interface Window {
		SpeechRecognition?: typeof SpeechRecognition
		webkitSpeechRecognition?: typeof SpeechRecognition
	}
}

export interface UseWebSpeechSTTOptions {
	/** BCP-47 language tag, e.g. "pt-BR", "en-US". Defaults to browser locale. */
	lang?: string
	onFinalTranscript?: (text: string, lang?: string) => void
}

export interface UseWebSpeechSTTReturn {
	isSupported: boolean
	isListening: boolean
	interimText: string
	error: string | null
	start: () => void
	stop: () => void
}

export function useWebSpeechSTT(options: UseWebSpeechSTTOptions = {}): UseWebSpeechSTTReturn {
	const { lang, onFinalTranscript } = options

	const SpeechRecognitionCtor =
		typeof window !== "undefined" ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined

	const isSupported = Boolean(SpeechRecognitionCtor)

	const recognitionRef = useRef<SpeechRecognition | null>(null)
	const onFinalRef = useRef(onFinalTranscript)
	onFinalRef.current = onFinalTranscript

	const [isListening, setIsListening] = useState(false)
	const [interimText, setInterimText] = useState("")
	const [error, setError] = useState<string | null>(null)

	// Tear down on unmount
	useEffect(() => {
		return () => {
			recognitionRef.current?.abort()
		}
	}, [])

	const start = useCallback(() => {
		if (!SpeechRecognitionCtor) return
		if (recognitionRef.current) {
			recognitionRef.current.abort()
		}

		setError(null)
		setInterimText("")

		const recognition = new SpeechRecognitionCtor()
		recognition.continuous = false
		recognition.interimResults = true
		recognition.maxAlternatives = 1
		if (lang) recognition.lang = lang

		recognition.onstart = () => setIsListening(true)

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			let interim = ""
			let final = ""
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcript = event.results[i][0].transcript
				if (event.results[i].isFinal) {
					final += transcript
				} else {
					interim += transcript
				}
			}
			setInterimText(interim)
			if (final) {
				setInterimText("")
				onFinalRef.current?.(final.trim(), recognition.lang)
			}
		}

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			// "aborted" is triggered by our own stop() — not a real error
			if (event.error !== "aborted") {
				setError(event.error)
			}
			setIsListening(false)
			setInterimText("")
		}

		recognition.onend = () => {
			setIsListening(false)
			setInterimText("")
		}

		recognitionRef.current = recognition
		recognition.start()
	}, [SpeechRecognitionCtor, lang])

	const stop = useCallback(() => {
		recognitionRef.current?.stop()
	}, [])

	return { isSupported, isListening, interimText, error, start, stop }
}
