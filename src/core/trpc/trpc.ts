import type { Controller } from "@core/controller"
import { initTRPC } from "@trpc/server"

export type TRPCContext = {
	controller: Controller
}

const t = initTRPC.context<TRPCContext>().create()

export const router = t.router
export const publicProcedure = t.procedure
