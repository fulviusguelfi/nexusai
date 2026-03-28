import { addRemoteMcpServer } from "@core/controller/mcp/addRemoteMcpServer"
import { authenticateMcpServer } from "@core/controller/mcp/authenticateMcpServer"
import { deleteMcpServer } from "@core/controller/mcp/deleteMcpServer"
import { downloadMcp } from "@core/controller/mcp/downloadMcp"
import { getLatestMcpServers } from "@core/controller/mcp/getLatestMcpServers"
import { openMcpSettings } from "@core/controller/mcp/openMcpSettings"
import { refreshMcpMarketplace } from "@core/controller/mcp/refreshMcpMarketplace"
import { restartMcpServer } from "@core/controller/mcp/restartMcpServer"
import { toggleMcpServer } from "@core/controller/mcp/toggleMcpServer"
import { toggleToolAutoApprove } from "@core/controller/mcp/toggleToolAutoApprove"
import { updateMcpTimeout } from "@core/controller/mcp/updateMcpTimeout"
import { z } from "zod"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const mcpRouter = router({
	toggleMcpServer: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => toggleMcpServer(ctx.controller, input as any)),
	updateMcpTimeout: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => updateMcpTimeout(ctx.controller, input as any)),
	addRemoteMcpServer: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => addRemoteMcpServer(ctx.controller, input as any)),
	downloadMcp: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => downloadMcp(ctx.controller, input as any)),
	restartMcpServer: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => restartMcpServer(ctx.controller, input as any)),
	deleteMcpServer: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => deleteMcpServer(ctx.controller, input as any)),
	toggleToolAutoApprove: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => toggleToolAutoApprove(ctx.controller, input as any)),
	refreshMcpMarketplace: publicProcedure.input(e).mutation(({ ctx, input }) => refreshMcpMarketplace(ctx.controller, input)),
	openMcpSettings: publicProcedure.input(e).mutation(({ ctx, input }) => openMcpSettings(ctx.controller, input)),
	authenticateMcpServer: publicProcedure
		.input(z.custom())
		.mutation(({ ctx, input }) => authenticateMcpServer(ctx.controller, input as any)),
	getLatestMcpServers: publicProcedure.input(e).query(({ ctx, input }) => getLatestMcpServers(ctx.controller, input)),
	// subscribeToMcpMarketplaceCatalog — streaming, stays on gRPC
	// subscribeToMcpServers — streaming, stays on gRPC
	// subscribeToOpenRouterModels — streaming, stays on gRPC
	// subscribeToLiteLlmModels — streaming, stays on gRPC
})
