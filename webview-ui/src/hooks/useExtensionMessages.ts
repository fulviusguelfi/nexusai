import { useEffect } from "react"
import { useLayout } from "../context/LayoutContext"
import { getWebviewType } from "../utils/detectWebviewType"

declare const vscode: any

/**
 * Hook to listen for direct extension messages (not via gRPC)
 * Used for simple commands that don't need the full gRPC infrastructure
 */
export const useExtensionMessages = () => {
	const { setOrientation } = useLayout()

	useEffect(() => {
		const handleMessage = (event: MessageEvent<any>) => {
			const message = event.data
			console.log("[useExtensionMessages] Received event:", {
				type: message?.type,
				hasOrientation: !!message?.orientation,
				allKeys: Object.keys(message || {}),
			})

			// Handle layout orientation changes
			if (message?.type === "setLayoutOrientation" && message?.orientation) {
				console.log("[useExtensionMessages] 🎯 Setting orientation to:", message.orientation)
				setOrientation(message.orientation)
			}
		}

		console.log("[useExtensionMessages] ✅ Registering message listener")
		window.addEventListener("message", handleMessage)
		return () => {
			console.log("[useExtensionMessages] ❌ Removing message listener")
			window.removeEventListener("message", handleMessage)
		}
	}, [setOrientation])

	// For editor panel: Request orientation from backend on mount
	// This ensures avatar appears even if initial message was missed
	useEffect(() => {
		const webviewType = getWebviewType()
		if (webviewType === "editor") {
			console.log("[useExtensionMessages] Editor panel detected - requesting orientation")
			setTimeout(() => {
				// Send Ready signal through vscode API to backend
				// This triggers the backend to resend orientation message
				if (typeof vscode !== "undefined" && vscode.postMessage) {
					vscode.postMessage({
						type: "webview_ready",
						webviewType: webviewType,
					})
				}
			}, 50)
		}
	}, [])
}
