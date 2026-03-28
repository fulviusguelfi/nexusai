import { z } from "zod"
import { checkpointDiff } from "@core/controller/checkpoints/checkpointDiff"
import { checkpointRestore } from "@core/controller/checkpoints/checkpointRestore"
import { getCwdHash } from "@core/controller/checkpoints/getCwdHash"
import { publicProcedure, router } from "../trpc"

export const checkpointsRouter = router({
	checkpointDiff: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => checkpointDiff(ctx.controller, input as any)),
	checkpointRestore: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => checkpointRestore(ctx.controller, input as any)),
	getCwdHash: publicProcedure.input(z.custom()).query(({ ctx, input }) => getCwdHash(ctx.controller, input as any)),
	// subscribeToCheckpoints — streaming, stays on gRPC
})
