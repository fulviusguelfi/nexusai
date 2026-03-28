import { z } from "zod"
import { getAihubmixModels } from "@core/controller/models/getAihubmixModels"
import { getLmStudioModels } from "@core/controller/models/getLmStudioModels"
import { getOllamaModels } from "@core/controller/models/getOllamaModels"
import { getSapAiCoreModels } from "@core/controller/models/getSapAiCoreModels"
import { getVsCodeLmModels } from "@core/controller/models/getVsCodeLmModels"
import { refreshBasetenModelsRpc } from "@core/controller/models/refreshBasetenModelsRpc"
import { refreshClineModelsRpc } from "@core/controller/models/refreshClineModelsRpc"
import { refreshClineRecommendedModelsRpc } from "@core/controller/models/refreshClineRecommendedModelsRpc"
import { refreshGroqModelsRpc } from "@core/controller/models/refreshGroqModelsRpc"
import { refreshHicapModels } from "@core/controller/models/refreshHicapModels"
import { refreshHuggingFaceModels } from "@core/controller/models/refreshHuggingFaceModels"
import { refreshLiteLlmModelsRpc } from "@core/controller/models/refreshLiteLlmModelsRpc"
import { refreshOcaModels } from "@core/controller/models/refreshOcaModels"
import { refreshOpenAiModels } from "@core/controller/models/refreshOpenAiModels"
import { refreshOpenRouterModelsRpc } from "@core/controller/models/refreshOpenRouterModelsRpc"
import { refreshRequestyModels } from "@core/controller/models/refreshRequestyModels"
import { refreshVercelAiGatewayModelsRpc } from "@core/controller/models/refreshVercelAiGatewayModelsRpc"
import { updateApiConfiguration } from "@core/controller/models/updateApiConfiguration"
import { updateApiConfigurationPartial } from "@core/controller/models/updateApiConfigurationPartial"
import { updateApiConfigurationProto } from "@core/controller/models/updateApiConfigurationProto"
import { publicProcedure, router } from "../trpc"

const e = z.object({})

export const modelsRouter = router({
	getOllamaModels: publicProcedure.input(z.custom()).query(({ ctx, input }) => getOllamaModels(ctx.controller, input as any)),
	getLmStudioModels: publicProcedure.input(z.custom()).query(({ ctx, input }) => getLmStudioModels(ctx.controller, input as any)),
	getVsCodeLmModels: publicProcedure.input(e).query(({ ctx, input }) => getVsCodeLmModels(ctx.controller, input)),
	refreshOpenRouterModelsRpc: publicProcedure.input(e).mutation(({ ctx, input }) => refreshOpenRouterModelsRpc(ctx.controller, input)),
	refreshClineRecommendedModelsRpc: publicProcedure.input(e).mutation(({ ctx, input }) => refreshClineRecommendedModelsRpc(ctx.controller, input)),
	refreshClineModelsRpc: publicProcedure.input(e).mutation(({ ctx, input }) => refreshClineModelsRpc(ctx.controller, input)),
	refreshHuggingFaceModels: publicProcedure.input(e).mutation(({ ctx, input }) => refreshHuggingFaceModels(ctx.controller, input)),
	refreshOpenAiModels: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => refreshOpenAiModels(ctx.controller, input as any)),
	refreshRequestyModels: publicProcedure.input(e).mutation(({ ctx, input }) => refreshRequestyModels(ctx.controller, input)),
	refreshHicapModels: publicProcedure.input(e).mutation(({ ctx, input }) => refreshHicapModels(ctx.controller, input)),
	refreshLiteLlmModelsRpc: publicProcedure.input(e).mutation(({ ctx, input }) => refreshLiteLlmModelsRpc(ctx.controller, input)),
	updateApiConfigurationProto: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => updateApiConfigurationProto(ctx.controller, input as any)),
	updateApiConfiguration: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => updateApiConfiguration(ctx.controller, input as any)),
	updateApiConfigurationPartial: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => updateApiConfigurationPartial(ctx.controller, input as any)),
	refreshGroqModelsRpc: publicProcedure.input(e).mutation(({ ctx, input }) => refreshGroqModelsRpc(ctx.controller, input)),
	refreshBasetenModelsRpc: publicProcedure.input(e).mutation(({ ctx, input }) => refreshBasetenModelsRpc(ctx.controller, input)),
	getSapAiCoreModels: publicProcedure.input(z.custom()).query(({ ctx, input }) => getSapAiCoreModels(ctx.controller, input as any)),
	refreshOcaModels: publicProcedure.input(z.custom()).mutation(({ ctx, input }) => refreshOcaModels(ctx.controller, input as any)),
	getAihubmixModels: publicProcedure.input(e).query(({ ctx, input }) => getAihubmixModels(ctx.controller, input)),
	refreshVercelAiGatewayModelsRpc: publicProcedure.input(e).mutation(({ ctx, input }) => refreshVercelAiGatewayModelsRpc(ctx.controller, input)),
	// subscribeToOpenRouterModels — streaming, stays on gRPC
	// subscribeToLiteLlmModels — streaming, stays on gRPC
})
