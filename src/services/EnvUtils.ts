import { isMultiRootWorkspace } from "@/core/workspace/utils/workspace-detection"
import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import { EmptyRequest } from "@/shared/proto/nexusai/common"
import { Logger } from "@/shared/services/Logger"

// Canonical header names for extra client/host context
export const NexusAIHeaders = {
	PLATFORM: "X-PLATFORM",
	PLATFORM_VERSION: "X-PLATFORM-VERSION",
	CLIENT_VERSION: "X-CLIENT-VERSION",
	CLIENT_TYPE: "X-CLIENT-TYPE",
	CORE_VERSION: "X-CORE-VERSION",
	IS_MULTIROOT: "X-IS-MULTIROOT",
} as const
export type NexusAIHeaderName = (typeof NexusAIHeaders)[keyof typeof NexusAIHeaders]

export function buildExternalBasicHeaders(): Record<string, string> {
	return {
		"User-Agent": `Cline/${ExtensionRegistryInfo.version}`,
	}
}

export async function buildBasicClineHeaders(): Promise<Record<string, string>> {
	const headers: Record<string, string> = buildExternalBasicHeaders()
	try {
		const host = await HostProvider.env.getHostVersion(EmptyRequest.create({}))
		headers[NexusAIHeaders.PLATFORM] = host.platform || "unknown"
		headers[NexusAIHeaders.PLATFORM_VERSION] = host.version || "unknown"
		headers[NexusAIHeaders.CLIENT_TYPE] = host.clineType || "unknown"
		headers[NexusAIHeaders.CLIENT_VERSION] = host.clineVersion || "unknown"
	} catch (error) {
		Logger.log("Failed to get IDE/platform info via HostBridge EnvService.getHostVersion", error)
		headers[NexusAIHeaders.PLATFORM] = "unknown"
		headers[NexusAIHeaders.PLATFORM_VERSION] = "unknown"
		headers[NexusAIHeaders.CLIENT_TYPE] = "unknown"
		headers[NexusAIHeaders.CLIENT_VERSION] = "unknown"
	}
	headers[NexusAIHeaders.CORE_VERSION] = ExtensionRegistryInfo.version

	return headers
}

export async function buildClineExtraHeaders(): Promise<Record<string, string>> {
	const headers = await buildBasicClineHeaders()

	try {
		const isMultiRoot = await isMultiRootWorkspace()
		headers[NexusAIHeaders.IS_MULTIROOT] = isMultiRoot ? "true" : "false"
	} catch (error) {
		Logger.log("Failed to detect multi-root workspace", error)
		headers[NexusAIHeaders.IS_MULTIROOT] = "false"
	}

	return headers
}
