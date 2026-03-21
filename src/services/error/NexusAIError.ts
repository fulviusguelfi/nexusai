// Backward compatibility re-exports — prefer importing from NexusError
export {
	AuthInvalidTokenError,
	AuthNetworkError,
	NexusError as NexusAIError,
	NexusError,
	NexusErrorType as NexusAIErrorType,
	NexusErrorType,
} from "./NexusError"
