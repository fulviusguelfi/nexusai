import { enumerateAudioDevices } from "@core/controller/voice/enumerateAudioDevices"
import { getVoiceStatus } from "@core/controller/voice/getVoiceStatus"
import { recordAndRespond } from "@core/controller/voice/recordAndRespond"
import { setVoiceSettings } from "@core/controller/voice/setVoiceSettings"
import { synthesizeSpeech } from "@core/controller/voice/synthesizeSpeech"
import { transcribeAudio } from "@core/controller/voice/transcribeAudio"
import { z } from "zod"
import { publicProcedure, router } from "../trpc"

export const voiceRouter = router({
	transcribeAudio: publicProcedure
		.input(
			z.object({
				float32Pcm: z.instanceof(Uint8Array),
				sampleRate: z.number(),
			}),
		)
		.mutation(({ ctx, input }) => transcribeAudio(ctx.controller, input)),

	synthesizeSpeech: publicProcedure
		.input(
			z.object({
				text: z.string(),
				voiceId: z.string().optional(),
				language: z.string().optional(),
			}),
		)
		.mutation(({ ctx, input }) => synthesizeSpeech(ctx.controller, input)),

	recordAndRespond: publicProcedure
		.input(
			z.object({
				maxDurationMs: z.number().optional(),
				silenceThreshold: z.number().optional(),
				silenceDurationMs: z.number().optional(),
				gracePeriodMs: z.number().optional(),
				sttModel: z.string().optional(),
				llmModel: z.string().optional(),
				ttsVoice: z.string().optional(),
				inputDeviceId: z.string().optional(),
			}),
		)
		.mutation(({ ctx, input }) => recordAndRespond(ctx.controller, input)),

	getVoiceStatus: publicProcedure.query(({ ctx }) => getVoiceStatus(ctx.controller, {})),

	setVoiceSettings: publicProcedure
		.input(
			z.object({
				whisperModel: z.string(),
				piperVoice: z.string(),
				speed: z.number(),
			}),
		)
		.mutation(({ ctx, input }) => setVoiceSettings(ctx.controller, input)),

	enumerateAudioDevices: publicProcedure.query(({ ctx }) => enumerateAudioDevices(ctx.controller, {})),
})
