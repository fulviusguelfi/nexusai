import { ocaAccountLoginClicked } from "@core/controller/ocaAccount/ocaAccountLoginClicked"
import { ocaAccountLogoutClicked } from "@core/controller/ocaAccount/ocaAccountLogoutClicked"
import { z } from "zod"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const ocaAccountRouter = router({
	ocaAccountLoginClicked: publicProcedure.input(e).mutation(({ ctx, input }) => ocaAccountLoginClicked(ctx.controller, input)),
	ocaAccountLogoutClicked: publicProcedure
		.input(e)
		.mutation(({ ctx, input }) => ocaAccountLogoutClicked(ctx.controller, input)),
	// ocaSubscribeToAuthStatusUpdate — streaming, stays on gRPC
})
