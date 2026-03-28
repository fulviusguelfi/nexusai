import { z } from "zod"
import { checkIsImageUrl } from "@core/controller/web/checkIsImageUrl"
import { fetchOpenGraphData } from "@core/controller/web/fetchOpenGraphData"
import { openInBrowser } from "@core/controller/web/openInBrowser"
import { publicProcedure, router } from "../trpc"

export const webRouter = router({
	checkIsImageUrl: publicProcedure.input(z.custom()).query(({ ctx, input }) => checkIsImageUrl(ctx.controller, input as any)),
	fetchOpenGraphData: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => fetchOpenGraphData(ctx.controller, input as any)),
	openInBrowser: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => openInBrowser(ctx.controller, input as any)),
})
