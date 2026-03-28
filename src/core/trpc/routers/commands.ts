import { z } from "zod"
import { addToCline } from "@core/controller/commands/addToCline"
import { explainWithCline } from "@core/controller/commands/explainWithCline"
import { fixWithCline } from "@core/controller/commands/fixWithCline"
import { improveWithCline } from "@core/controller/commands/improveWithCline"
import { publicProcedure, router } from "../trpc"

export const commandsRouter = router({
	addToCline: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => addToCline(ctx.controller, input as any)),
	fixWithCline: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => fixWithCline(ctx.controller, input as any)),
	explainWithCline: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => explainWithCline(ctx.controller, input as any)),
	improveWithCline: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => improveWithCline(ctx.controller, input as any)),
})
