import type { EmptyRequest } from "@shared/proto/cline/common"
import { Empty } from "@shared/proto/cline/common"
import { Logger } from "@/shared/services/Logger"
import type { Controller } from "../index"

/**
 * Opens the editor panel with Chat + Avatar layout
 * This is called from the sidebar webview when user clicks "New Task" button
 * @param controller The controller instance
 * @param request Empty request
 * @returns Empty response
 */
export async function openEditorPanel(_controller: Controller, _request: EmptyRequest): Promise<Empty> {
	try {
		Logger.log("[openEditorPanel] Opening editor panel from sidebar")
		// Dynamic import to avoid circular dependencies
		const { EditorWebviewPanelProvider } = await import("@hosts/vscode/EditorWebviewPanelProvider")
		await EditorWebviewPanelProvider.createOrShow()
		Logger.log("[openEditorPanel] Editor panel opened successfully")
	} catch (error) {
		Logger.error("[openEditorPanel] Failed to open editor panel:", error)
		throw error
	}

	return Empty.create({})
}
