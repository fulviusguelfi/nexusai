import { afterEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import type { Controller } from "@/core/controller"
import type { NexusAIAuthInfo } from "@/services/auth/AuthService"
import { AuthNetworkError } from "@/services/error/NexusError"
import { NexusAuthProvider } from "../NexusAuthProvider"

function makeAuthInfo(tokenExpSeconds: number, expiresAtSeconds: number): NexusAIAuthInfo {
	return {
		idToken: `token-${tokenExpSeconds}`,
		refreshToken: "refresh-token",
		expiresAt: expiresAtSeconds,
		provider: "cline",
		startedAt: Date.now() - 1000,
		userInfo: {
			id: "user-1",
			email: "user@example.com",
			displayName: "Test User",
			createdAt: "2026-03-10T00:00:00.000Z",
			organizations: [],
		},
	}
}

function makeControllerWithAuth(authInfo: NexusAIAuthInfo): Controller {
	return {
		stateManager: {
			getSecretKey: sinon.stub().withArgs("cline:clineAccountId").returns(JSON.stringify(authInfo)),
			setSecret: sinon.stub(),
		},
	} as unknown as Controller
}

describe("NexusAuthProvider.retrieveClineAuthInfo", () => {
	afterEach(() => {
		sinon.restore()
	})

	it("returns null when refresh fails with network error and stored token is already expired", async () => {
		const now = Math.floor(Date.now() / 1000)
		const authInfo = makeAuthInfo(now - 30, now - 10)
		const controller = makeControllerWithAuth(authInfo)
		const provider = new NexusAuthProvider()

		sinon.stub(provider, "shouldRefreshIdToken").resolves(true)
		sinon.stub(provider, "timeUntilExpiry").returns(-1)
		sinon.stub(provider, "refreshToken").rejects(new AuthNetworkError("Network error during token refresh"))

		const result = await provider.retrieveClineAuthInfo(controller)

		;(result === null).should.be.true()
	})
})
