import { z } from "zod"
import { askResponse } from "@core/controller/task/askResponse"
import { cancelBackgroundCommand } from "@core/controller/task/cancelBackgroundCommand"
import { cancelTask } from "@core/controller/task/cancelTask"
import { clearTask } from "@core/controller/task/clearTask"
import { deleteAllTaskHistory } from "@core/controller/task/deleteAllTaskHistory"
import { deleteTasksWithIds } from "@core/controller/task/deleteTasksWithIds"
import { executeQuickWin } from "@core/controller/task/executeQuickWin"
import { explainChanges } from "@core/controller/task/explainChanges"
import { exportTaskWithId } from "@core/controller/task/exportTaskWithId"
import { getTaskHistory } from "@core/controller/task/getTaskHistory"
import { getTotalTasksSize } from "@core/controller/task/getTotalTasksSize"
import { newTask } from "@core/controller/task/newTask"
import { showTaskWithId } from "@core/controller/task/showTaskWithId"
import { taskCompletionViewChanges } from "@core/controller/task/taskCompletionViewChanges"
import { taskFeedback } from "@core/controller/task/taskFeedback"
import { toggleTaskFavorite } from "@core/controller/task/toggleTaskFavorite"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const taskRouter = router({
	cancelTask: publicProcedure.input(e).mutation(({ ctx, input }) => cancelTask(ctx.controller, input)),
	cancelBackgroundCommand: publicProcedure.input(e).mutation(({ ctx, input }) => cancelBackgroundCommand(ctx.controller, input)),
	clearTask: publicProcedure.input(e).mutation(({ ctx, input }) => clearTask(ctx.controller, input)),
	getTotalTasksSize: publicProcedure.input(e).query(({ ctx, input }) => getTotalTasksSize(ctx.controller, input)),
	deleteTasksWithIds: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => deleteTasksWithIds(ctx.controller, input as any)),
	newTask: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => newTask(ctx.controller, input as any)),
	showTaskWithId: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => showTaskWithId(ctx.controller, input as any)),
	exportTaskWithId: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => exportTaskWithId(ctx.controller, input as any)),
	toggleTaskFavorite: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => toggleTaskFavorite(ctx.controller, input as any)),
	getTaskHistory: publicProcedure.input(z.custom()).query(({ ctx, input }) => getTaskHistory(ctx.controller, input as any)),
	askResponse: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => askResponse(ctx.controller, input as any)),
	taskFeedback: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => taskFeedback(ctx.controller, input as any)),
	taskCompletionViewChanges: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => taskCompletionViewChanges(ctx.controller, input as any)),
	executeQuickWin: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => executeQuickWin(ctx.controller, input as any)),
	deleteAllTaskHistory: publicProcedure.mutation(({ ctx }) => deleteAllTaskHistory(ctx.controller)),
	explainChanges: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => explainChanges(ctx.controller, input as any)),
})
