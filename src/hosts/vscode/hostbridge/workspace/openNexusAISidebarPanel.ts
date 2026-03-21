import * as vscode from "vscode"
import { ExtensionRegistryInfo } from "@/registry"
import { OpenNexusAISidebarPanelRequest, OpenNexusAISidebarPanelResponse } from "@/shared/proto/index.host"

export async function openNexusAISidebarPanel(_: OpenNexusAISidebarPanelRequest): Promise<OpenNexusAISidebarPanelResponse> {
	await vscode.commands.executeCommand(`${ExtensionRegistryInfo.views.Sidebar}.focus`)
	return {}
}
