import { captureOnboardingProgress } from "@core/controller/state/captureOnboardingProgress"
import { checkCliInstallation } from "@core/controller/state/checkCliInstallation"
import { flushPendingState } from "@core/controller/state/flushPendingState"
import { getAvailableTerminalProfiles } from "@core/controller/state/getAvailableTerminalProfiles"
import { getLatestState } from "@core/controller/state/getLatestState"
import { getProcessInfo } from "@core/controller/state/getProcessInfo"
import { installClineCli } from "@core/controller/state/installClineCli"
import { refreshRemoteConfig } from "@core/controller/state/refreshRemoteConfig"
import { resetState } from "@core/controller/state/resetState"
import { setWelcomeViewCompleted } from "@core/controller/state/setWelcomeViewCompleted"
import { testOtelConnection } from "@core/controller/state/testOtelConnection"
import { testPromptUploading } from "@core/controller/state/testPromptUploading"
import { toggleFavoriteModel } from "@core/controller/state/toggleFavoriteModel"
import { togglePlanActModeProto } from "@core/controller/state/togglePlanActModeProto"
import { updateAutoApprovalSettings } from "@core/controller/state/updateAutoApprovalSettings"
import { updateSettings } from "@core/controller/state/updateSettings"
import { updateSettingsCli } from "@core/controller/state/updateSettingsCli"
import { updateTaskSettings } from "@core/controller/state/updateTaskSettings"
import { updateTelemetrySetting } from "@core/controller/state/updateTelemetrySetting"
import { updateTerminalConnectionTimeout } from "@core/controller/state/updateTerminalConnectionTimeout"
import { updateTerminalReuseEnabled } from "@core/controller/state/updateTerminalReuseEnabled"
import { z } from "zod"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const stateRouter = router({
	getLatestState: publicProcedure.input(e).query(({ ctx, input }) => getLatestState(ctx.controller, input)),
	updateTerminalConnectionTimeout: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => updateTerminalConnectionTimeout(ctx.controller, input as any)),
	updateTerminalReuseEnabled: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => updateTerminalReuseEnabled(ctx.controller, input as any)),
	getAvailableTerminalProfiles: publicProcedure
		.input(e)
		.query(({ ctx, input }) => getAvailableTerminalProfiles(ctx.controller, input)),
	toggleFavoriteModel: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => toggleFavoriteModel(ctx.controller, input as any)),
	resetState: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => resetState(ctx.controller, input as any)),
	togglePlanActModeProto: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => togglePlanActModeProto(ctx.controller, input as any)),
	updateAutoApprovalSettings: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => updateAutoApprovalSettings(ctx.controller, input as any)),
	updateSettings: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => updateSettings(ctx.controller, input as any)),
	updateSettingsCli: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => updateSettingsCli(ctx.controller, input as any)),
	updateTaskSettings: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => updateTaskSettings(ctx.controller, input as any)),
	updateTelemetrySetting: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => updateTelemetrySetting(ctx.controller, input as any)),
	captureOnboardingProgress: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => captureOnboardingProgress(ctx.controller, input as any)),
	setWelcomeViewCompleted: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => setWelcomeViewCompleted(ctx.controller, input as any)),
	installClineCli: publicProcedure.input(e).mutation(({ ctx, input }) => installClineCli(ctx.controller, input)),
	checkCliInstallation: publicProcedure.query(({ ctx }) => checkCliInstallation(ctx.controller)),
	getProcessInfo: publicProcedure.input(e).query(({ ctx, input }) => getProcessInfo(ctx.controller, input)),
	flushPendingState: publicProcedure.input(e).mutation(({ ctx, input }) => flushPendingState(ctx.controller, input)),
	refreshRemoteConfig: publicProcedure.input(e).mutation(({ ctx, input }) => refreshRemoteConfig(ctx.controller, input)),
	testOtelConnection: publicProcedure.input(e).mutation(({ ctx, input }) => testOtelConnection(ctx.controller, input)),
	testPromptUploading: publicProcedure.input(e).mutation(({ ctx, input }) => testPromptUploading(ctx.controller, input)),
	// subscribeToState — streaming, stays on gRPC
})
