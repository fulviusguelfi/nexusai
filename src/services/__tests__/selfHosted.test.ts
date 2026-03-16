/**
 * Tests verifying that all service factories always return no-op providers
 * now that PostHog has been removed from NexusAI.
 */

import * as assert from "assert"
import { ErrorProviderFactory } from "../error/ErrorProviderFactory"
import { FeatureFlagsProviderFactory } from "../feature-flags/FeatureFlagsProviderFactory"

describe("Service Factories always return no-op providers", () => {
	describe("FeatureFlagsProviderFactory", () => {
		it("should always return no-op config", () => {
			const config = FeatureFlagsProviderFactory.getDefaultConfig()
			assert.strictEqual(config.type, "no-op", "Should always return no-op type")
		})

		it("should create an enabled NoOp provider", () => {
			const config = FeatureFlagsProviderFactory.getDefaultConfig()
			const provider = FeatureFlagsProviderFactory.createProvider(config)
			assert.strictEqual(provider.isEnabled(), true, "NoOp provider should report as enabled")
		})
	})

	describe("ErrorProviderFactory", () => {
		it("should always return no-op config", () => {
			const config = ErrorProviderFactory.getDefaultConfig()
			assert.strictEqual(config.type, "no-op", "Should always return no-op type")
		})

		it("should create an enabled NoOp provider", async () => {
			const config = ErrorProviderFactory.getDefaultConfig()
			const provider = await ErrorProviderFactory.createProvider(config)
			assert.strictEqual(provider.isEnabled(), true, "NoOp provider should report as enabled")
			await provider.dispose()
		})
	})

	describe("Integration - all factories return no-op", () => {
		it("should return no-op for all factories regardless of environment", () => {
			const featureFlagsConfig = FeatureFlagsProviderFactory.getDefaultConfig()
			const errorConfig = ErrorProviderFactory.getDefaultConfig()

			assert.strictEqual(featureFlagsConfig.type, "no-op", "FeatureFlags should always be no-op")
			assert.strictEqual(errorConfig.type, "no-op", "Error provider should always be no-op")
		})
	})
})
