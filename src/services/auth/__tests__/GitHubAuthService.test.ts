import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import type { GitHubAuthState } from "@shared/proto/cline/account"
import type { EmptyRequest } from "@shared/proto/cline/common"
import sinon from "sinon"
import type { Controller } from "@/core/controller"
import * as vscodeMock from "../../../test/vscode-mock"
import { GitHubAuthService } from "../GitHubAuthService"

// The vscode module is intercepted by src/test/requires.ts and returns vscodeMock.
// We stub vscodeMock.authentication.getSession directly via sinon.

describe("GitHubAuthService", () => {
	let sandbox: sinon.SinonSandbox
	let service: GitHubAuthService

	const mockSession = {
		id: "session-1",
		accessToken: "tok123",
		account: { id: "user-1", label: "octocat" },
		scopes: ["read:user"],
	}

	beforeEach(() => {
		sandbox = sinon.createSandbox()
		// Reset singleton between tests
		;(GitHubAuthService as unknown as { _instance: GitHubAuthService | undefined })._instance = undefined
		service = GitHubAuthService.getInstance()
	})

	afterEach(() => {
		service.dispose()
		sandbox.restore()
	})

	describe("getState()", () => {
		it("returns isSignedIn: false when no session", () => {
			const state = service.getState()
			state.should.deepEqual({ isSignedIn: false })
		})

		it("returns isSignedIn: true with displayName when session exists", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").resolves(mockSession)
			await service.signIn()
			const state = service.getState()
			state.isSignedIn.should.be.true()
			;(state.displayName as string).should.equal("octocat")
			;(state.login as string).should.equal("octocat")
		})
	})

	describe("signIn()", () => {
		it("returns signed-in state on successful session", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").resolves(mockSession)
			const state = await service.signIn()
			state.isSignedIn.should.be.true()
			;(state.displayName as string).should.equal("octocat")
			;(state.login as string).should.equal("octocat")
		})

		it("returns isSignedIn: false when user cancels", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").rejects(new Error("User cancelled"))
			const state = await service.signIn()
			state.should.deepEqual({ isSignedIn: false })
		})

		it("returns isSignedIn: false when getSession resolves undefined", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").resolves(undefined)
			const state = await service.signIn()
			state.should.deepEqual({ isSignedIn: false })
		})
	})

	describe("signOut()", () => {
		it("clears session and getState returns isSignedIn: false", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").resolves(mockSession)
			await service.signIn()
			await service.signOut()
			service.getState().should.deepEqual({ isSignedIn: false })
		})

		it("broadcasts isSignedIn: false to subscribers", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").resolves(mockSession)
			await service.signIn()

			const received: GitHubAuthState[] = []
			const handler = async (state: GitHubAuthState) => {
				received.push(state)
			}
			// Manually add handler (simulates subscribe without grpc overhead)
			;(service as unknown as { _activeHandlers: Set<(state: GitHubAuthState) => Promise<void>> })._activeHandlers.add(
				handler,
			)

			await service.signOut()

			received.some((s) => s.isSignedIn === false).should.be.true()
		})
	})

	describe("subscribe()", () => {
		it("sends current state immediately on subscribe", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").resolves(mockSession)
			await service.signIn()

			const received: GitHubAuthState[] = []
			const handler = async (state: GitHubAuthState, _done?: boolean) => {
				received.push(state)
			}

			await service.subscribe({} as unknown as Controller, {} as unknown as EmptyRequest, handler)

			received.length.should.be.greaterThan(0)
			received[0].isSignedIn.should.be.true()
		})

		it("sends isSignedIn: false immediately when no session", async () => {
			const received: GitHubAuthState[] = []
			const handler = async (state: GitHubAuthState, _done?: boolean) => {
				received.push(state)
			}

			await service.subscribe({} as unknown as Controller, {} as unknown as EmptyRequest, handler)

			received.length.should.equal(1)
			received[0].should.deepEqual({ isSignedIn: false })
		})
	})

	describe("refreshSilently()", () => {
		it("updates session when silent getSession returns a session", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").resolves(mockSession)
			await service.refreshSilently()
			service.getState().isSignedIn.should.be.true()
		})

		it("clears session when silent getSession returns nothing", async () => {
			sandbox.stub(vscodeMock.authentication, "getSession").resolves(undefined)
			// Manually inject a session first
			;(service as unknown as { _session: typeof mockSession | undefined })._session = mockSession
			await service.refreshSilently()
			service.getState().should.deepEqual({ isSignedIn: false })
		})
	})

	describe("getInstance()", () => {
		it("returns the same instance on repeated calls", () => {
			const a = GitHubAuthService.getInstance()
			const b = GitHubAuthService.getInstance()
			a.should.equal(b)
		})

		it("creates a new instance after dispose", () => {
			const a = GitHubAuthService.getInstance()
			a.dispose()
			const b = GitHubAuthService.getInstance()
			b.should.not.equal(a)
			b.dispose()
		})
	})
})
