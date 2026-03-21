import { Empty, StringRequest } from "@shared/proto/nexusai/common"
import * as vscode from "vscode"

const NEXUSAI_OUTPUT_CHANNEL = vscode.window.createOutputChannel("NexusAI")

// Appends a log message to all NexusAI output channels.
export async function debugLog(request: StringRequest): Promise<Empty> {
	NEXUSAI_OUTPUT_CHANNEL.appendLine(request.value)
	return Empty.create({})
}

// Register the NexusAI output channel within the VSCode extension context.
export function registerClineOutputChannel(context: vscode.ExtensionContext): vscode.OutputChannel {
	context.subscriptions.push(NEXUSAI_OUTPUT_CHANNEL)
	return NEXUSAI_OUTPUT_CHANNEL
}
