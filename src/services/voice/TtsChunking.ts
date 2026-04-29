export function splitIntoSpeechChunks(text: string): string[] {
	const raw = text.split(/(?<=[.!?。！？])\s+/)
	const sentences = raw.map((part) => part.trim()).filter(Boolean)
	if (sentences.length === 0) {
		return [text.trim()].filter(Boolean)
	}

	const chunks: string[] = []
	let current = ""

	for (const sentence of sentences) {
		if (!current) {
			current = sentence
			continue
		}

		const candidate = `${current} ${sentence}`.trim()
		const shouldMerge = candidate.length <= 220 && (current.length < 140 || sentence.length < 80)

		if (shouldMerge) {
			current = candidate
		} else {
			chunks.push(current)
			current = sentence
		}
	}

	if (current) {
		chunks.push(current)
	}

	return chunks.length > 0 ? chunks : [text.trim()].filter(Boolean)
}
