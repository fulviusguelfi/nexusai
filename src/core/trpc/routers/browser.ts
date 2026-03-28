import { z } from "zod"
import { discoverBrowser } from "@core/controller/browser/discoverBrowser"
import { getBrowserConnectionInfo } from "@core/controller/browser/getBrowserConnectionInfo"
import { getDetectedChromePath } from "@core/controller/browser/getDetectedChromePath"
import { relaunchChromeDebugMode } from "@core/controller/browser/relaunchChromeDebugMode"
import { testBrowserConnection } from "@core/controller/browser/testBrowserConnection"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const browserRouter = router({
	getBrowserConnectionInfo: publicProcedure.input(e).query(({ ctx, input }) => getBrowserConnectionInfo(ctx.controller, input)),
	testBrowserConnection: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => testBrowserConnection(ctx.controller, input as any)),
	discoverBrowser: publicProcedure.input(e).mutation(({ ctx, input }) => discoverBrowser(ctx.controller, input)),
	getDetectedChromePath: publicProcedure.input(e).query(({ ctx, input }) => getDetectedChromePath(ctx.controller, input)),
	relaunchChromeDebugMode: publicProcedure.input(e).mutation(({ ctx, input }) => relaunchChromeDebugMode(ctx.controller, input)),
})
