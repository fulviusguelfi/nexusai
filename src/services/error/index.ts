import { ErrorSettings } from "./providers/IErrorProvider"

export { type ErrorProviderConfig, ErrorProviderFactory, type ErrorProviderType } from "./ErrorProviderFactory"
export { ErrorService } from "./ErrorService"
export { AuthInvalidTokenError, AuthNetworkError, NexusAIError, NexusAIErrorType, NexusError, NexusErrorType } from "./NexusError"
export type { ErrorSettings, IErrorProvider } from "./providers/IErrorProvider"

export function getErrorLevelFromString(level: string | undefined): ErrorSettings["level"] {
	switch (level) {
		case "disabled":
		case "off":
			return "off"
		case "error":
		case "crash":
			return "error"
		default:
			return "all"
	}
}
