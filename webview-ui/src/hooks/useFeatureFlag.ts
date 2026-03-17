/**
 * Hook to check feature flag status in the webview.
 * PostHog has been removed — always returns false.
 */
export const useHasFeatureFlag = (_flagName: string): boolean => {
	return false
}
