import { VaultService } from "@services/vault/VaultService"
import { z } from "zod"
import { publicProcedure, router } from "../trpc"

export const vaultRouter = router({
	/** List all vault entry metadata (no values). */
	listEntries: publicProcedure.query(({ ctx }) => {
		const svc = new VaultService(ctx.controller.stateManager)
		return svc.listEntries()
	}),

	/** Create a new vault entry. The value is persisted in SecretStorage only. */
	createEntry: publicProcedure
		.input(
			z.object({
				label: z.string().min(1).max(100),
				type: z.enum(["password", "card", "document", "text"]),
				value: z.string().min(1),
			}),
		)
		.mutation(({ ctx, input }) => {
			const svc = new VaultService(ctx.controller.stateManager)
			return svc.createEntry(input.label, input.type, input.value)
		}),

	/** Delete a vault entry and its stored value. */
	deleteEntry: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
		const svc = new VaultService(ctx.controller.stateManager)
		await svc.deleteEntry(input.id)
		return { ok: true }
	}),

	/** Get the current vault security system prompt text. */
	getSystemPrompt: publicProcedure.query(({ ctx }) => {
		const value = ctx.controller.stateManager.getGlobalStateKey("vaultSystemPrompt")
		return { value: value as string | undefined }
	}),

	/** Persist a custom vault security system prompt text. */
	setSystemPrompt: publicProcedure.input(z.object({ text: z.string().max(4000) })).mutation(({ ctx, input }) => {
		ctx.controller.stateManager.setGlobalState("vaultSystemPrompt", input.text)
		return { ok: true }
	}),
})
