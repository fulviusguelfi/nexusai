import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"

const id = NexusAIDefaultTool.HTTP_REQUEST

const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "http_request",
	description:
		"Make an HTTP/HTTPS request to an external URL and return the response status, headers, and body. " +
		"Private/local IPs are blocked by default (SSRF protection) — use register_device with trusted_local=true to allow local device APIs. " +
		"Requires user approval.",
	parameters: [
		{
			name: "url",
			required: true,
			instruction: "Full URL including protocol, e.g. https://api.example.com/v1/status.",
			usage: "https://api.example.com/v1/status",
		},
		{
			name: "method",
			required: false,
			instruction: "HTTP method: GET, POST, PUT, DELETE, PATCH. Defaults to GET.",
			usage: "GET",
		},
		{
			name: "headers",
			required: false,
			instruction: "JSON object of request headers.",
			usage: '{"Authorization":"Bearer token123","Content-Type":"application/json"}',
		},
		{
			name: "body",
			required: false,
			instruction: "Request body string (for POST/PUT/PATCH).",
			usage: '{"key":"value"}',
		},
		{
			name: "timeout_ms",
			required: false,
			type: "integer",
			instruction: "Request timeout in milliseconds. Defaults to 10000.",
			usage: "10000",
		},
		{
			name: "follow_redirects",
			required: false,
			type: "boolean",
			instruction: "Whether to follow HTTP redirects. Defaults to true.",
			usage: "true",
		},
	],
}

const NATIVE_GPT_5: NexusAIToolSpec = {
	...generic,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: NexusAIToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const http_request_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
