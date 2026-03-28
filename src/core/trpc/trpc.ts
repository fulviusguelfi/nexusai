import { initTRPC } from "@trpc/server"
import type { Controller } from "@core/controller"

export type TRPCContext = {
	controller: Controller
}

const t = initTRPC.context<TRPCContext>().create()

export const router = t.router
export const publicProcedure = t.procedure
