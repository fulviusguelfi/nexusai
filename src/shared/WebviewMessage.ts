export interface WebviewMessage {
	type:
		| "grpc_request"
		| "grpc_request_cancel"
		| "trpc_request"
		| "voice_float32_audio"
		| "debug_voice_error"
		| "start_voice_recording"
		| "stop_voice_recording"
		| "webview_ready"
		| "voice_mic_diagnostic_result"
		| "voice_sentence_ended"
	grpc_request?: GrpcRequest
	grpc_request_cancel?: GrpcCancel
	trpc_request?: TrpcRequest
	voice_float32_audio?: { buffer: ArrayBuffer; sampleRate: number }
	debug_voice_error?: {
		source: string // "VoiceRecorder" | "VoiceSettingsSection"
		stage: string // "device_enumeration" | "permission_request" | "stream_setup"
		errorName: string // "NotAllowedError" | "NotFoundError" | "AbortError"
		errorMessage: string // full error.message
		deviceId: string // selected deviceId or "default"
		userAgent: string // navigator.userAgent
		timestamp: string // ISO 8601
	}
	start_voice_recording?: {
		timestamp: number // Unix milliseconds for request tracking
		silenceThresholdMs?: number // Optional silence threshold in milliseconds
		gracePeriodMs?: number // Optional grace period before silence detection activates
		maxDurationMs?: number // Optional max recording duration in milliseconds
	}
	stop_voice_recording?: {
		timestamp: number // Unix milliseconds for request tracking
	}
	webview_ready?: {
		webviewType: "sidebar" | "editor"
	}
	voice_mic_diagnostic_result?: {
		granted: boolean
		errorName: string | null
	}
	voice_sentence_ended?: {
		sentenceIndex: number
	}
}

export type GrpcRequest = {
	service: string
	method: string
	message: unknown // JSON serialized protobuf message
	request_id: string // For correlating requests and responses
	is_streaming: boolean // Whether this is a streaming request
}

export type TrpcRequest = {
	id: string
	type: "query" | "mutation" | "subscription"
	path: string
	input: unknown
}

export type GrpcCancel = {
	request_id: string // ID of the request to cancel
}

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse"

export type ClineCheckpointRestore = "task" | "workspace" | "taskAndWorkspace"

export type TaskFeedbackType = "thumbs_up" | "thumbs_down"
