import * as vscode from "vscode"
import { StreamingResponseHandler } from "@/hosts/vscode/hostbridge-grpc-handler"
import { Setting } from "@/shared/proto/index.host"
import { EmptyRequest } from "@/shared/proto/index.nexusai"

/**
 * Subscribe to changes to the telemetry settings.
 */
export async function subscribeToTelemetrySettings(
	_: EmptyRequest,
	responseStream: StreamingResponseHandler,
	_requestId?: string,
): Promise<void> {
	vscode.env.onDidChangeTelemetryEnabled((isTelemetryEnabled) => {
		const event = { isEnabled: isTelemetryEnabled ? Setting.ENABLED : Setting.DISABLED }
		responseStream(event, false)
	})
}
