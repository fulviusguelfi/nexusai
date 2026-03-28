import { z } from "zod"
import { accountLoginClicked } from "@core/controller/account/accountLoginClicked"
import { accountLogoutClicked } from "@core/controller/account/accountLogoutClicked"
import { authStateChanged } from "@core/controller/account/authStateChanged"
import { getOrganizationCredits } from "@core/controller/account/getOrganizationCredits"
import { getRedirectUrl } from "@core/controller/account/getRedirectUrl"
import { getUserCredits } from "@core/controller/account/getUserCredits"
import { getUserOrganizations } from "@core/controller/account/getUserOrganizations"
import { githubSignIn } from "@core/controller/account/githubSignIn"
import { githubSignOut } from "@core/controller/account/githubSignOut"
import { hicapAuthClicked } from "@core/controller/account/hicapAuthClicked"
import { openAiCodexSignIn } from "@core/controller/account/openAiCodexSignIn"
import { openAiCodexSignOut } from "@core/controller/account/openAiCodexSignOut"
import { openrouterAuthClicked } from "@core/controller/account/openrouterAuthClicked"
import { requestyAuthClicked } from "@core/controller/account/requestyAuthClicked"
import { setUserOrganization } from "@core/controller/account/setUserOrganization"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const accountRouter = router({
	accountLoginClicked: publicProcedure.input(e).mutation(({ ctx, input }) => accountLoginClicked(ctx.controller, input)),
	accountLogoutClicked: publicProcedure.input(e).mutation(({ ctx, input }) => accountLogoutClicked(ctx.controller, input)),
	authStateChanged: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => authStateChanged(ctx.controller, input as any)),
	getUserCredits: publicProcedure.input(e).query(({ ctx, input }) => getUserCredits(ctx.controller, input)),
	getOrganizationCredits: publicProcedure.input(z.custom()).query(({ ctx, input }) => getOrganizationCredits(ctx.controller, input as any)),
	getUserOrganizations: publicProcedure.input(e).query(({ ctx, input }) => getUserOrganizations(ctx.controller, input)),
	setUserOrganization: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => setUserOrganization(ctx.controller, input as any)),
	openrouterAuthClicked: publicProcedure.input(e).mutation(({ ctx, input }) => openrouterAuthClicked(ctx.controller, input)),
	requestyAuthClicked: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => requestyAuthClicked(ctx.controller, input as any)),
	hicapAuthClicked: publicProcedure.input(e).mutation(({ ctx, input }) => hicapAuthClicked(ctx.controller, input)),
	getRedirectUrl: publicProcedure.input(e).query(({ ctx, input }) => getRedirectUrl(ctx.controller, input)),
	openAiCodexSignIn: publicProcedure.input(e).mutation(({ ctx, input }) => openAiCodexSignIn(ctx.controller, input)),
	openAiCodexSignOut: publicProcedure.input(e).mutation(({ ctx, input }) => openAiCodexSignOut(ctx.controller, input)),
	githubSignIn: publicProcedure.input(e).mutation(({ ctx, input }) => githubSignIn(ctx.controller, input)),
	githubSignOut: publicProcedure.input(e).mutation(({ ctx, input }) => githubSignOut(ctx.controller, input)),
	// subscribeToAuthStatusUpdate — streaming, stays on gRPC
	// subscribeToGitHubAuthState — streaming, stays on gRPC
})
