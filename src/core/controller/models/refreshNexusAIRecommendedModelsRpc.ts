import { EmptyRequest } from "@shared/proto/nexusai/common"
import { NexusAIRecommendedModel, NexusAIRecommendedModelsResponse } from "@shared/proto/nexusai/models"
import type { Controller } from "../index"
import { refreshClineRecommendedModels } from "./refreshClineRecommendedModels"

export async function refreshNexusAIRecommendedModelsRpc(
	_controller: Controller,
	_request: EmptyRequest,
): Promise<NexusAIRecommendedModelsResponse> {
	const models = await refreshClineRecommendedModels()
	return NexusAIRecommendedModelsResponse.create({
		recommended: models.recommended.map((model) =>
			NexusAIRecommendedModel.create({
				id: model.id,
				name: model.name,
				description: model.description,
				tags: model.tags,
			}),
		),
		free: models.free.map((model) =>
			NexusAIRecommendedModel.create({
				id: model.id,
				name: model.name,
				description: model.description,
				tags: model.tags,
			}),
		),
	})
}
