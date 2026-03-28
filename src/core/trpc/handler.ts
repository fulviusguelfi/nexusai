import type { Controller } from "@core/controller"
import type { ExtensionMessage } from "@shared/ExtensionMessage"
import { Logger } from "@shared/services/Logger"
import { appRouter } from "./router"

export type TrpcRequest = {
	id: string
	type: "query" | "mutation" | "subscription"
	path: string
	input: unknown
}

type PostFn = (message: ExtensionMessage) => void

/**
 * Handle a tRPC request from the webview.
 *
 * Resolves the procedure path (e.g. "voice.enumerateAudioDevices") against
 * the appRouter caller, executes it, and posts the result (or error) back.
 */
export async function handleTrpcRequest(
	controller: Controller,
	postMessageToWebview: PostFn,
	request: TrpcRequest,
): Promise<void> {
	const { id, path, input } = request

	const respond = (result: unknown, error?: string) =>
		postMessageToWebview({
			type: "trpc_response",
			trpc_response: { id, result: error ? undefined : result, error },
		})

	try {
		const caller = appRouter.createCaller({ controller })

		// Resolve nested path: "voice.enumerateAudioDevices" → caller.voice.enumerateAudioDevices
		const parts = path.split(".")
		let procedure: unknown = caller
		for (const part of parts) {
			procedure = (procedure as Record<string, unknown>)[part]
			if (procedure === undefined) {
				throw new Error(`Procedure not found: ${path}`)
			}
		}

		const result = await (procedure as (input: unknown) => Promise<unknown>)(input)
		respond(result)
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		Logger.error(`[tRPC] ${path} failed:`, err)
		respond(undefined, message)
	}
}
