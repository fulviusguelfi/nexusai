import { z } from "zod"
import { condense } from "@core/controller/slash/condense"
import { getAvailableSlashCommands } from "@core/controller/slash/getAvailableSlashCommands"
import { reportBug } from "@core/controller/slash/reportBug"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const slashRouter = router({
	reportBug: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => reportBug(ctx.controller, input as any)),
	condense: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => condense(ctx.controller, input as any)),
	getAvailableSlashCommands: publicProcedure.input(e).query(({ ctx, input }) => getAvailableSlashCommands(ctx.controller, input)),
})
