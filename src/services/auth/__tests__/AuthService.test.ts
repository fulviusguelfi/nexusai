import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import type { Controller } from "@/core/controller"
import { Logger } from "@/shared/services/Logger"
import { AuthService, type ClineAuthInfo } from "../AuthService"

function makeAuthInfo(): ClineAuthInfo {
	return {
		idToken: "id-token",
		refreshToken: "refresh-token",
		expiresAt: Math.floor(Date.now() / 1000) + 3600,
		provider: "cline",
		startedAt: Date.now() - 1000,
		userInfo: {
			id: "user-1",
			email: "user@example.com",
			displayName: "User",
			createdAt: "2026-03-18T00:00:00.000Z",
			organizations: [],
		},
	}
}

describe("AuthService.restoreRefreshTokenAndRetrieveAuthInfo", () => {
	let sandbox: sinon.SinonSandbox
	let service: AuthService

	beforeEach(() => {
		sandbox = sinon.createSandbox()
		;(AuthService as unknown as { instance: AuthService | null }).instance = null

		const controller = {
			stateManager: {
				setSecret: sandbox.stub(),
				getSecretKey: sandbox.stub(),
			},
			postStateToWebview: sandbox.stub().resolves(),
		} as unknown as Controller

		service = AuthService.getInstance(controller)
	})

	afterEach(() => {
		sandbox.restore()
		;(AuthService as unknown as { instance: AuthService | null }).instance = null
	})

	it("captures error_recovery logout and clears local auth when restore returns null", async () => {
		const warnStub = sandbox.stub(Logger, "warn")
		sandbox
			.stub(service as unknown as { retrieveAuthInfo: () => Promise<ClineAuthInfo | null> }, "retrieveAuthInfo")
			.resolves(null)

		;(service as unknown as { _authenticated: boolean })._authenticated = true
		;(service as unknown as { _clineAuthInfo: ClineAuthInfo | null })._clineAuthInfo = makeAuthInfo()

		await service.restoreRefreshTokenAndRetrieveAuthInfo()
		await Promise.resolve()

		;(service as unknown as { _authenticated: boolean })._authenticated.should.be.false()
		;((service as unknown as { _clineAuthInfo: ClineAuthInfo | null })._clineAuthInfo === null).should.be.true()
		warnStub.calledWithMatch("No user found after restoring auth token").should.be.true()
	})

	it("handles retrieveAuthInfo errors by resetting auth state and logging restore failure", async () => {
		const restoreError = new Error("network down")
		const errorStub = sandbox.stub(Logger, "error")
		sandbox
			.stub(service as unknown as { retrieveAuthInfo: () => Promise<ClineAuthInfo | null> }, "retrieveAuthInfo")
			.rejects(restoreError)

		;(service as unknown as { _authenticated: boolean })._authenticated = true
		;(service as unknown as { _clineAuthInfo: ClineAuthInfo | null })._clineAuthInfo = makeAuthInfo()

		await service.restoreRefreshTokenAndRetrieveAuthInfo()

		;(service as unknown as { _authenticated: boolean })._authenticated.should.be.false()
		;((service as unknown as { _clineAuthInfo: ClineAuthInfo | null })._clineAuthInfo === null).should.be.true()
		errorStub.calledWithMatch("Error restoring auth token:", restoreError).should.be.true()
	})
})
