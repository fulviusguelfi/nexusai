import { copyToClipboard } from "@core/controller/file/copyToClipboard"
import { createHook } from "@core/controller/file/createHook"
import { createRuleFile } from "@core/controller/file/createRuleFile"
import { createSkillFile } from "@core/controller/file/createSkillFile"
import { deleteHook } from "@core/controller/file/deleteHook"
import { deleteRuleFile } from "@core/controller/file/deleteRuleFile"
import { deleteSkillFile } from "@core/controller/file/deleteSkillFile"
import { getRelativePaths } from "@core/controller/file/getRelativePaths"
import { ifFileExistsRelativePath } from "@core/controller/file/ifFileExistsRelativePath"
import { openDiskConversationHistory } from "@core/controller/file/openDiskConversationHistory"
import { openFile } from "@core/controller/file/openFile"
import { openFileRelativePath } from "@core/controller/file/openFileRelativePath"
import { openFocusChainFile } from "@core/controller/file/openFocusChainFile"
import { openImage } from "@core/controller/file/openImage"
import { openMention } from "@core/controller/file/openMention"
import { refreshHooks } from "@core/controller/file/refreshHooks"
import { refreshRules } from "@core/controller/file/refreshRules"
import { refreshSkills } from "@core/controller/file/refreshSkills"
import { searchCommits } from "@core/controller/file/searchCommits"
import { searchFiles } from "@core/controller/file/searchFiles"
import { selectFiles } from "@core/controller/file/selectFiles"
import { toggleAgentsRule } from "@core/controller/file/toggleAgentsRule"
import { toggleClineRule } from "@core/controller/file/toggleClineRule"
import { toggleCursorRule } from "@core/controller/file/toggleCursorRule"
import { toggleHook } from "@core/controller/file/toggleHook"
import { toggleSkill } from "@core/controller/file/toggleSkill"
import { toggleWindsurfRule } from "@core/controller/file/toggleWindsurfRule"
import { toggleWorkflow } from "@core/controller/file/toggleWorkflow"
import { z } from "zod"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const fileRouter = router({
	copyToClipboard: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => copyToClipboard(ctx.controller, input as any)),
	openFile: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => openFile(ctx.controller, input as any)),
	openImage: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => openImage(ctx.controller, input as any)),
	openMention: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => openMention(ctx.controller, input as any)),
	deleteRuleFile: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => deleteRuleFile(ctx.controller, input as any)),
	createRuleFile: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => createRuleFile(ctx.controller, input as any)),
	searchCommits: publicProcedure.input(z.custom()).query(({ ctx, input }) => searchCommits(ctx.controller, input as any)),
	selectFiles: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => selectFiles(ctx.controller, input as any)),
	getRelativePaths: publicProcedure.input(z.custom()).query(({ ctx, input }) => getRelativePaths(ctx.controller, input as any)),
	searchFiles: publicProcedure.input(z.custom()).query(({ ctx, input }) => searchFiles(ctx.controller, input as any)),
	toggleClineRule: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => toggleClineRule(ctx.controller, input as any)),
	toggleCursorRule: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => toggleCursorRule(ctx.controller, input as any)),
	toggleWindsurfRule: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => toggleWindsurfRule(ctx.controller, input as any)),
	toggleAgentsRule: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => toggleAgentsRule(ctx.controller, input as any)),
	refreshRules: publicProcedure.input(e).mutation(({ ctx, input }) => refreshRules(ctx.controller, input)),
	openDiskConversationHistory: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => openDiskConversationHistory(ctx.controller, input as any)),
	toggleWorkflow: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => toggleWorkflow(ctx.controller, input as any)),
	ifFileExistsRelativePath: publicProcedure
		.input(z.custom())
		.query(({ ctx, input }) => ifFileExistsRelativePath(ctx.controller, input as any)),
	openFileRelativePath: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => openFileRelativePath(ctx.controller, input as any)),
	openFocusChainFile: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => openFocusChainFile(ctx.controller, input as any)),
	refreshHooks: publicProcedure.input(e).mutation(({ ctx, input }) => refreshHooks(ctx.controller, input)),
	toggleHook: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => toggleHook(ctx.controller, input as any)),
	createHook: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => createHook(ctx.controller, input as any)),
	deleteHook: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => deleteHook(ctx.controller, input as any)),
	refreshSkills: publicProcedure.mutation(({ ctx }) => refreshSkills(ctx.controller)),
	toggleSkill: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => toggleSkill(ctx.controller, input as any)),
	createSkillFile: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => createSkillFile(ctx.controller, input as any)),
	deleteSkillFile: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => deleteSkillFile(ctx.controller, input as any)),
})
