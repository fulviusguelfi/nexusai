import { z } from "zod"
import { getWebviewHtml } from "@core/controller/ui/getWebviewHtml"
import { initializeWebview } from "@core/controller/ui/initializeWebview"
import { onDidShowAnnouncement } from "@core/controller/ui/onDidShowAnnouncement"
import { openUrl } from "@core/controller/ui/openUrl"
import { openWalkthrough } from "@core/controller/ui/openWalkthrough"
import { scrollToSettings } from "@core/controller/ui/scrollToSettings"
import { setTerminalExecutionMode } from "@core/controller/ui/setTerminalExecutionMode"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const uiRouter = router({
	scrollToSettings: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => scrollToSettings(ctx.controller, input as any)),
	setTerminalExecutionMode: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => setTerminalExecutionMode(ctx.controller, input as any)),
	onDidShowAnnouncement: publicProcedure.input(e).mutation(({ ctx, input }) => onDidShowAnnouncement(ctx.controller, input)),
	initializeWebview: publicProcedure.input(e).mutation(({ ctx, input }) => initializeWebview(ctx.controller, input)),
	getWebviewHtml: publicProcedure.input(e).query(({ ctx, input }) => getWebviewHtml(ctx.controller, input)),
	openUrl: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => openUrl(ctx.controller, input as any)),
	openWalkthrough: publicProcedure.input(e).mutation(({ ctx, input }) => openWalkthrough(ctx.controller, input)),
	// subscribeToAddToInput — streaming, stays on gRPC
	// subscribeTo{Mcp,History,Chat,Account,Settings,Worktrees}ButtonClicked — streaming, stays on gRPC
	// subscribeToPartialMessage — streaming, stays on gRPC
	// subscribeToRelinquishControl — streaming, stays on gRPC
	// subscribeToShowWebview — streaming, stays on gRPC
})
