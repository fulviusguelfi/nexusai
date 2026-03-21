import * as vscode from "vscode"
import { ErrorSettings } from "@/services/error"
import { GetTelemetrySettingsResponse, Setting } from "@/shared/proto/index.host"
import { EmptyRequest } from "@/shared/proto/index.nexusai"

export async function getTelemetrySettings(_: EmptyRequest): Promise<GetTelemetrySettingsResponse> {
	const config = vscode.workspace.getConfiguration("telemetry")
	const errorLevel = config?.get<ErrorSettings["level"]>("telemetryLevel") || "all"

	if (vscode.env.isTelemetryEnabled) {
		return { isEnabled: Setting.ENABLED, errorLevel }
	}
	return { isEnabled: Setting.DISABLED, errorLevel }
}
