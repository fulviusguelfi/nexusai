import { describe, it } from "mocha"
import "should"
import type { PromptVariant, SystemPromptContext } from "../../types"
import { getVoiceBehaviorSection } from "../voice_behavior"

// Minimal stubs for unused parameters
const variant = {} as PromptVariant
const baseContext: SystemPromptContext = {
	providerInfo: {} as SystemPromptContext["providerInfo"],
	ide: "vscode",
}

describe("getVoiceBehaviorSection()", () => {
	it("formal tone → prompt contains formal language instruction", async () => {
		const result = await getVoiceBehaviorSection(variant, {
			...baseContext,
			avatarPersonalityTone: "formal",
		})
		result.should.containEql("formal language")
	})

	it("casual tone → prompt contains conversational instruction", async () => {
		const result = await getVoiceBehaviorSection(variant, {
			...baseContext,
			avatarPersonalityTone: "casual",
		})
		result.should.containEql("conversational")
	})

	it("technical tone → prompt contains technical vocabulary instruction", async () => {
		const result = await getVoiceBehaviorSection(variant, {
			...baseContext,
			avatarPersonalityTone: "technical",
		})
		result.should.containEql("technical vocabulary")
	})

	it("concise mode → prompt contains 2 sentences constraint", async () => {
		const result = await getVoiceBehaviorSection(variant, {
			...baseContext,
			avatarPersonalityResponseMode: "concise",
		})
		result.should.containEql("2 sentences")
	})

	it("detailed mode → prompt contains thorough instruction", async () => {
		const result = await getVoiceBehaviorSection(variant, {
			...baseContext,
			avatarPersonalityResponseMode: "detailed",
		})
		result.should.containEql("thorough")
	})

	it("avatarName 'Nexus' → prompt refers to avatar as Nexus", async () => {
		const result = await getVoiceBehaviorSection(variant, {
			...baseContext,
			avatarName: "Nexus",
		})
		result.should.containEql("Nexus")
	})

	it("anti-confusion rule is present regardless of tone", async () => {
		for (const tone of ["formal", "casual", "technical"] as const) {
			const result = await getVoiceBehaviorSection(variant, {
				...baseContext,
				avatarPersonalityTone: tone,
			})
			result.should.containEql("NEVER repeat back")
		}
	})

	it("defaults to NexusAI name when avatarName is not provided", async () => {
		const result = await getVoiceBehaviorSection(variant, baseContext)
		result.should.containEql("NexusAI")
	})
})
