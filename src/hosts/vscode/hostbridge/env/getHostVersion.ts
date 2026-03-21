import { EmptyRequest } from "@shared/proto/nexusai/common"
import * as vscode from "vscode"
import { ExtensionRegistryInfo } from "@/registry"
import { NexusAIClient } from "@/shared/nexusai"
import { GetHostVersionResponse } from "@/shared/proto/index.host"

export async function getHostVersion(_: EmptyRequest): Promise<GetHostVersionResponse> {
	return {
		platform: vscode.env.appName,
		version: vscode.version,
		clineType: NexusAIClient.VSCode,
		clineVersion: ExtensionRegistryInfo.version,
	}
}
