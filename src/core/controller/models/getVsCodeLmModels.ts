import { EmptyRequest } from "@shared/proto/cline/common"
import { VsCodeLmModelsArray } from "@shared/proto/cline/models"
import * as vscode from "vscode"
import { Logger } from "@/shared/services/Logger"
import { convertVsCodeNativeModelsToProtoModels } from "../../../shared/proto-conversions/models/vscode-lm-models-conversion"
import { Controller } from ".."

/**
 * Fetches available models from VS Code LM API
 * @param controller The controller instance
 * @param request Empty request
 * @returns Array of VS Code LM models
 */
export async function getVsCodeLmModels(_controller: Controller, _request: EmptyRequest): Promise<VsCodeLmModelsArray> {
	try {
		// Check if the vscode.lm API is available at all
		if (!vscode.lm || typeof vscode.lm.selectChatModels !== "function") {
			Logger.warn(
				"[getVsCodeLmModels] vscode.lm.selectChatModels is NOT available — VSCode version may be too old or API unavailable",
			)
			return VsCodeLmModelsArray.create({ models: [] })
		}
		Logger.debug("[getVsCodeLmModels] Calling vscode.lm.selectChatModels({})...")
		const models = await vscode.lm.selectChatModels({})
		if (!models || models.length === 0) {
			Logger.debug("[getVsCodeLmModels] 0 models returned — ensure GitHub.copilot-chat is installed, active, and signed in")
		} else {
			Logger.log(
				`[getVsCodeLmModels] selectChatModels returned ${models.length} model(s):`,
				models.map((m) => `${m.vendor}/${m.family}/${m.id}`),
			)
		}

		const protoModels = convertVsCodeNativeModelsToProtoModels(models || [])
		Logger.debug(`[getVsCodeLmModels] Converted to ${protoModels.length} proto model(s)`)

		return VsCodeLmModelsArray.create({ models: protoModels })
	} catch (error) {
		Logger.error("[getVsCodeLmModels] Error fetching VS Code LM models:", error)
		return VsCodeLmModelsArray.create({ models: [] })
	}
}
