/**
 * Whisper Worker Thread
 *
 * Runs @huggingface/transformers ONNX inference in a separate thread
 * to avoid blocking the VS Code extension host during transcription.
 *
 * Messages received from parent:
 *   { type: 'init', cacheDir: string }
 *   { type: 'transcribe', float32PCM: SharedArrayBuffer, sampleRate: number }
 *
 * Messages sent to parent:
 *   { type: 'ready' }
 *   { type: 'result', text: string }
 *   { type: 'error', message: string }
 */

import { parentPort } from "worker_threads"

if (!parentPort) {
	throw new Error("whisper.worker must be started as a worker thread")
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const transformers = require("@huggingface/transformers")
const { pipeline, env } = transformers

let transcriber: any = null
let modelCacheDir: string | null = null

parentPort.on("message", async (msg: any) => {
	if (!parentPort) return

	if (msg.type === "init") {
		modelCacheDir = msg.cacheDir
		env.cacheDir = modelCacheDir
		// Pre-warm the model on init for faster first transcription
		try {
			transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
				dtype: "fp32",
				device: "cpu",
			})
			parentPort.postMessage({ type: "ready" })
		} catch (err: any) {
			parentPort.postMessage({ type: "error", message: `Model load failed: ${err?.message ?? err}` })
		}
		return
	}

	if (msg.type === "transcribe") {
		try {
			if (!transcriber) {
				// Lazy init if 'init' was skipped
				if (!modelCacheDir) {
					parentPort.postMessage({ type: "error", message: "Worker not initialised (no cacheDir)" })
					return
				}
				env.cacheDir = modelCacheDir
				transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
					dtype: "fp32",
					device: "cpu",
				})
			}

			// Reconstruct Float32Array from transferred ArrayBuffer
			const float32 = new Float32Array(msg.float32PCM)

			// Extract language hint from message (e.g., "pt" for Portuguese)
			// This helps Whisper understand the language to expect
			const languageHint = msg.language ?? undefined

			parentPort.postMessage({
				type: "debug",
				message: `Transcribing with language hint: ${languageHint || "auto-detect"}`,
			})

			// Run transcription with optional language hint
			// CRITICAL: Do NOT translate - transcribe in original language only
			// Language hint helps Whisper focus on the expected language
			const transcribeOptions: any = {
				sampling_rate: msg.sampleRate ?? 16000,
				task: "transcribe", // DO NOT CHANGE TO "translate" - we want original language!
				return_all_outputs: true, // Ensure we get complete output
			}

			// Add language hint if provided (helps Whisper understand language context)
			if (languageHint) {
				transcribeOptions.language = languageHint
				parentPort.postMessage({
					type: "debug",
					message: `Applied language hint to Whisper: "${languageHint}"`,
				})
			}

			const result = await transcriber(float32, transcribeOptions)

			// Log full result for debugging language detection
			const resultKeys = result ? Object.keys(result).join(", ") : "null"
			const firstElementKeys = Array.isArray(result) && result[0] ? Object.keys(result[0]).join(", ") : "N/A"
			parentPort.postMessage({
				type: "debug",
				resultStructure: {
					resultType: Array.isArray(result) ? "array" : typeof result,
					resultKeys: resultKeys,
					firstElementKeys: firstElementKeys,
					hasLanguageField: !!result?.language,
					firstElementHasLanguage: Array.isArray(result) && !!result[0]?.language,
				},
				fullResult: result,
			})

			// CRITICAL: Extract ONLY original transcribed text
			// Ignore any 'translation' field that might be auto-generated
			let text = ""
			if (Array.isArray(result)) {
				// If result is array, first element should be the ASR output
				text = result[0]?.text ?? ""
				if (!text && result[0]?.chunks) {
					// Fallback: combine chunks
					text = (result[0].chunks || []).map((c: any) => c.text || "").join(" ")
				}
			} else if (result?.text) {
				// Direct text access
				text = result.text
			}

			// Log what we extracted
			parentPort.postMessage({
				type: "debug",
				message: `Extracted text: "${text.substring(0, 50)}..."`,
				ignored: result?.translation
					? `(Ignored translation: "${result.translation.substring(0, 30)}...")`
					: "no translation field",
			})

			// Detect language from multiple possible locations in Whisper output
			// IMPORTANT: Language detection flow
			//   1. Check result.language (standard Whisper field)
			//   2. Check result[0].language (if result is array)
			//   3. Check result.detected_language (alternative property)
			//   4. Check result[0].detected_language (array with alt property)
			//   5. Check result.chunks[0].language (if chunks exist)
			//   6. Fallback to "unknown" (NOT English!)
			let detectedLanguage = "unknown" // DO NOT default to English!

			// Try to extract language code from various possible locations
			if (result?.language) {
				// Standard Whisper output location (returns code like "pt", "pt-BR", "en", etc.)
				detectedLanguage = result.language
				parentPort.postMessage({
					type: "debug",
					message: `Language found at result.language: "${detectedLanguage}"`,
				})
			} else if (Array.isArray(result) && result[0]?.language) {
				// Language in first element of array
				detectedLanguage = result[0].language
				parentPort.postMessage({
					type: "debug",
					message: `Language found at result[0].language: "${detectedLanguage}"`,
				})
			} else if (result?.detected_language) {
				// Alternative property name
				detectedLanguage = result.detected_language
				parentPort.postMessage({
					type: "debug",
					message: `Language found at result.detected_language: "${detectedLanguage}"`,
				})
			} else if (Array.isArray(result) && result[0]?.detected_language) {
				// Array element alternative
				detectedLanguage = result[0].detected_language
				parentPort.postMessage({
					type: "debug",
					message: `Language found at result[0].detected_language: "${detectedLanguage}"`,
				})
			} else if (Array.isArray(result) && result[0]?.chunks?.[0]?.language) {
				// Language in chunk metadata
				detectedLanguage = result[0].chunks[0].language
				parentPort.postMessage({
					type: "debug",
					message: `Language found at result[0].chunks[0].language: "${detectedLanguage}"`,
				})
			} else {
				parentPort.postMessage({
					type: "debug",
					message: `⚠️ Language not found in Whisper output. Using heuristic detection from text...`,
				})

				// Fallback: Detect language from transcribed text using heuristics
				// Since Whisper-tiny doesn't return language metadata, we analyze the text
				const analyzedLanguage = detectLanguageFromText(text)
				parentPort.postMessage({
					type: "debug",
					message: `Language detected from text heuristics: "${analyzedLanguage}"`,
				})

				if (analyzedLanguage === "unknown" && languageHint) {
					// Text too short or ambiguous for heuristics — trust the hint language
					detectedLanguage = expandLanguageCode(languageHint)
					parentPort.postMessage({
						type: "debug",
						message: `Heuristics inconclusive — falling back to hint language: "${detectedLanguage}"`,
					})
				} else {
					detectedLanguage = analyzedLanguage
				}
			}

			// Expand short language codes to regional BCP-47 (e.g., "pt" → "pt-BR")
			if (!detectedLanguage.includes("-") && detectedLanguage !== "unknown") {
				detectedLanguage = expandLanguageCode(detectedLanguage)
			}

			parentPort.postMessage({
				type: "result",
				text: text.trim(),
				language: detectedLanguage,
			})
		} catch (err: any) {
			parentPort.postMessage({ type: "error", message: `Transcription failed: ${err?.message ?? err}` })
		}
		return
	}
})

/**
 * Expand a short language code to its regional BCP-47 form
 * E.g., "pt" → "pt-BR", "en" → "en-US", "es" → "es-ES"
 */
function expandLanguageCode(code: string): string {
	const defaults: Record<string, string> = {
		pt: "pt-BR",
		en: "en-US",
		es: "es-ES",
		fr: "fr-FR",
		de: "de-DE",
		it: "it-IT",
		ja: "ja-JP",
		zh: "zh-CN",
		ko: "ko-KR",
		ru: "ru-RU",
	}
	return defaults[code] ?? code
}

/**
 * Simple heuristic language detection from transcribed text
 * Since Whisper-tiny doesn't return language metadata, we analyze the text content
 *
 * This is NOT perfect, but helps identify common languages based on keywords
 * Better solution: Install 'franc' library for ML-based detection
 */
function detectLanguageFromText(text: string): string {
	if (!text || text.length === 0) {
		return "unknown"
	}

	const lowerText = text.toLowerCase()

	// Portuguese (Brazil) indicators
	const ptIndicators = [
		// Nasal vowels (unique to Portuguese)
		"ão",
		"ões",
		"ãe",
		// Gerunds ending in -ando / -endo / -indo (very common in spoken PT)
		"testando",
		"falando",
		"gravando",
		"ouvindo",
		"trabalhando",
		"fazendo",
		"sendo",
		"indo",
		"vindo",
		// Common test/voice words that appear in "som teste 1 2"
		"som",
		"teste",
		"testando",
		// Pronouns
		"você",
		"vosso",
		"vocês",
		// "to be" conjugations
		"está",
		"estou",
		"estamos",
		"estão",
		"sou",
		"somos",
		"são",
		// Possessives
		"meu",
		"minha",
		"nosso",
		"nossa",
		// Common phrases
		"tudo bem",
		"tá bom",
		"tá certo",
		"pois é",
		// Conjunctions
		"porque",
		"porém",
		// Particles
		"não",
		"sim",
		"talvez",
		// Prepositions
		"para",
		"pelo",
		"pela",
		"pelos",
		"pelas",
		// Adverbs
		"já",
		"ainda",
		"também",
		"nem",
		// Pronouns
		"nada",
		"ninguém",
		"alguém",
		// Time & location words
		"aqui",
		"aí",
		"ali",
		"lá",
		"agora",
	]

	// English indicators
	const enIndicators = [
		"the",
		"is",
		"are",
		"and",
		"with",
		"that",
		"have",
		"has",
		"from",
		"you",
		"your",
		"he",
		"she",
		"they",
		"their",
		"about",
		"would",
		"could",
		"should",
		"been",
		"more",
		"also",
		"just",
		"only",
		"very",
		"time",
		"day",
		"year",
		"right",
		"good",
		"hello",
		"thanks",
		"please",
		"okay",
		"yes",
		"no",
	]

	// Count matches for each language
	let ptScore = 0
	let enScore = 0

	ptIndicators.forEach((indicator) => {
		const regex = new RegExp(`\\b${indicator}\\b`, "g")
		const matches = lowerText.match(regex) || []
		ptScore += matches.length
	})

	enIndicators.forEach((indicator) => {
		const regex = new RegExp(`\\b${indicator}\\b`, "g")
		const matches = lowerText.match(regex) || []
		enScore += matches.length
	})

	parentPort?.postMessage({
		type: "debug",
		message: `Language heuristic scores: PT=${ptScore}, EN=${enScore}`,
	})

	// Return language with highest score
	if (ptScore > enScore && ptScore > 0) {
		return "pt-BR" // Portuguese (Brazil)
	}
	if (enScore > 0) {
		return "en" // English
	}

	// Default: try to guess from text characteristics
	// Portuguese has more accented characters than English
	const accentedChars = (lowerText.match(/[áàâäãéèêëíìîïóòôöõúùûüç]/g) || []).length
	if (accentedChars > 2) {
		return "pt-BR" // Likely Portuguese (has many accented chars)
	}

	return "unknown"
}
