import * as http from "node:http"
import * as https from "node:https"
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { DeviceRegistry } from "@services/iot/DeviceRegistry"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const PRIVATE_IP_RE = /^(127\.|10\.|169\.254\.|::1$|fd[0-9a-f]{2}:)/i
const RFC1918_172_RE = /^172\.(1[6-9]|2\d|3[01])\./
const RFC1918_192_RE = /^192\.168\./

function isPrivateIp(host: string): boolean {
	return PRIVATE_IP_RE.test(host) || RFC1918_172_RE.test(host) || RFC1918_192_RE.test(host)
}

export class HttpRequestToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.HTTP_REQUEST

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const method = (block.params.method ?? "GET").toUpperCase()
		return `[http_request ${method} ${block.params.url}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const url: string | undefined = block.params.url
		const method = (block.params.method ?? "GET").toUpperCase()
		const headersRaw: string | undefined = block.params.headers
		const bodyRaw: string | undefined = block.params.body
		const timeoutMs = block.params.timeout_ms ? Number.parseInt(block.params.timeout_ms, 10) : 10_000
		const followRedirects = block.params.follow_redirects !== "false"

		if (!url) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "url")
		}

		let parsedUrl: URL
		try {
			parsedUrl = new URL(url)
		} catch {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError(`Invalid URL: ${url}`)
		}

		// SSRF guard: block private/loopback addresses unless device is trusted
		const hostname = parsedUrl.hostname
		if (isPrivateIp(hostname)) {
			const trusted = DeviceRegistry.getByIp(hostname)?.trustedLocal === true
			if (!trusted) {
				config.taskState.consecutiveMistakeCount++
				return formatResponse.toolError(
					`SSRF protection: requests to private IP ${hostname} are not allowed. ` +
						`Register the device with register_device and set trustedLocal=true to allow it.`,
				)
			}
		}

		let headers: Record<string, string> = {}
		if (headersRaw) {
			try {
				headers = JSON.parse(headersRaw)
			} catch {
				config.taskState.consecutiveMistakeCount++
				return formatResponse.toolError("Invalid JSON in headers parameter.")
			}
		}

		try {
			const result = await makeRequest(parsedUrl, method, headers, bodyRaw, timeoutMs, followRedirects, 0)
			const sayContent = JSON.stringify({ tool: "http_request", content: `${method} ${url} → ${result.statusCode}` })
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)

			const responseText =
				`Status: ${result.statusCode}\n` + `Headers: ${JSON.stringify(result.headers, null, 2)}\n\n` + result.body
			return [{ type: "text", text: responseText }]
		} catch (error: unknown) {
			return formatResponse.toolError(`HTTP request failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}

interface HttpResult {
	statusCode: number
	headers: Record<string, string | string[] | undefined>
	body: string
}

function makeRequest(
	url: URL,
	method: string,
	headers: Record<string, string>,
	body: string | undefined,
	timeoutMs: number,
	followRedirects: boolean,
	redirectCount: number,
): Promise<HttpResult> {
	const MAX_REDIRECTS = 5
	return new Promise((resolve, reject) => {
		const isHttps = url.protocol === "https:"
		const lib = isHttps ? https : http
		const bodyBuffer = body ? Buffer.from(body, "utf-8") : undefined

		const reqHeaders: Record<string, string> = { ...headers }
		if (bodyBuffer) {
			reqHeaders["content-length"] = String(bodyBuffer.length)
		}

		const options: http.RequestOptions = {
			method,
			hostname: url.hostname,
			port: url.port || (isHttps ? 443 : 80),
			path: url.pathname + url.search,
			headers: reqHeaders,
		}

		const req = lib.request(options, (res) => {
			// Handle redirects
			if (followRedirects && res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				if (redirectCount >= MAX_REDIRECTS) {
					reject(new Error(`Too many redirects (max ${MAX_REDIRECTS})`))
					return
				}
				let redirectUrl: URL
				try {
					redirectUrl = new URL(res.headers.location, url)
				} catch {
					reject(new Error(`Invalid redirect location: ${res.headers.location}`))
					return
				}
				// Consume response body before redirect
				res.resume()
				makeRequest(redirectUrl, method, headers, body, timeoutMs, followRedirects, redirectCount + 1)
					.then(resolve)
					.catch(reject)
				return
			}

			const chunks: Buffer[] = []
			res.on("data", (chunk: Buffer) => chunks.push(chunk))
			res.on("end", () => {
				resolve({
					statusCode: res.statusCode ?? 0,
					headers: res.headers as Record<string, string | string[] | undefined>,
					body: Buffer.concat(chunks).toString("utf-8"),
				})
			})
			res.on("error", reject)
		})

		req.setTimeout(timeoutMs, () => {
			req.destroy(new Error(`Request timed out after ${timeoutMs}ms`))
		})

		req.on("error", reject)

		if (bodyBuffer) {
			req.write(bodyBuffer)
		}
		req.end()
	})
}
