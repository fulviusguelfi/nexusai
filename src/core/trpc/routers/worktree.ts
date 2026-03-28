import { z } from "zod"
import { checkoutBranch } from "@core/controller/worktree/checkoutBranch"
import { createWorktree } from "@core/controller/worktree/createWorktree"
import { createWorktreeInclude } from "@core/controller/worktree/createWorktreeInclude"
import { deleteWorktree } from "@core/controller/worktree/deleteWorktree"
import { getAvailableBranches } from "@core/controller/worktree/getAvailableBranches"
import { getWorktreeDefaults } from "@core/controller/worktree/getWorktreeDefaults"
import { getWorktreeIncludeStatus } from "@core/controller/worktree/getWorktreeIncludeStatus"
import { listWorktrees } from "@core/controller/worktree/listWorktrees"
import { mergeWorktree } from "@core/controller/worktree/mergeWorktree"
import { switchWorktree } from "@core/controller/worktree/switchWorktree"
import { trackWorktreeViewOpened } from "@core/controller/worktree/trackWorktreeViewOpened"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const worktreeRouter = router({
	listWorktrees: publicProcedure.input(e).query(({ ctx, input }) => listWorktrees(ctx.controller, input)),
	createWorktree: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => createWorktree(ctx.controller, input as any)),
	deleteWorktree: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => deleteWorktree(ctx.controller, input as any)),
	switchWorktree: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => switchWorktree(ctx.controller, input as any)),
	getAvailableBranches: publicProcedure.input(e).query(({ ctx, input }) => getAvailableBranches(ctx.controller, input)),
	getWorktreeDefaults: publicProcedure.input(e).query(({ ctx, input }) => getWorktreeDefaults(ctx.controller, input)),
	getWorktreeIncludeStatus: publicProcedure.input(e).query(({ ctx, input }) => getWorktreeIncludeStatus(ctx.controller, input)),
	createWorktreeInclude: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => createWorktreeInclude(ctx.controller, input as any)),
	checkoutBranch: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => checkoutBranch(ctx.controller, input as any)),
	mergeWorktree: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => mergeWorktree(ctx.controller, input as any)),
	trackWorktreeViewOpened: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => trackWorktreeViewOpened(ctx.controller, input as any)),
})
