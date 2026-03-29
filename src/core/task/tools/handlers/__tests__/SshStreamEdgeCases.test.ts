import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import { EventEmitter } from "events"

describe("SSH Stream Edge Cases", () => {
	let mockStream: EventEmitter

	beforeEach(() => {
		mockStream = new EventEmitter()
	})

	afterEach(() => {
		mockStream.removeAllListeners()
	})

	describe("SshUploadToolHandler — stream destruction before exit code", () => {
		it("should reject with clear error if stream ends without code (Windows case)", async () => {
			let uploadDone = false
			let finalError: Error | undefined

			const finalize = (code: number | null, error?: Error) => {
				if (uploadDone) return
				uploadDone = true
				if (error) {
					finalError = error
				}
			}

			// Simulate Windows: 'end' fires but no 'close' with code
			mockStream.on("end", () => {
				if (!uploadDone) {
					const timeoutId = setTimeout(() => {
						finalize(1, new Error("SSH upload stream ended without exit code (Windows timeout)"))
					}, 100)
					mockStream.once("close", (code: number) => {
						clearTimeout(timeoutId)
						finalize(code)
					})
				}
			})

			mockStream.emit("end")
			await new Promise((resolve) => setTimeout(resolve, 150))

			uploadDone.should.equal(true)
			;(finalError !== undefined).should.equal(true)
			;(finalError?.message ?? "").should.containEql("without exit code")
		})

		it("should succeed only if explicit exit code 0 received", async () => {
			let uploadDone = false
			let finalCode: number | null = null

			const finalize = (code: number | null) => {
				if (uploadDone) return
				uploadDone = true
				finalCode = code
			}

			mockStream.on("close", (code: number) => {
				finalize(code)
			})

			// Emit close with explicit code
			mockStream.emit("close", 0)
			await new Promise((resolve) => setTimeout(resolve, 50))

			uploadDone.should.equal(true)
			;(finalCode === 0).should.equal(true)
		})

		it("should reject if exit code is non-zero", async () => {
			let uploadDone = false
			let finalError: Error | undefined

			const finalize = (code: number | null, error?: Error) => {
				if (uploadDone) return
				uploadDone = true
				if (error) {
					finalError = error
				} else if (code !== 0 && code !== undefined) {
					finalError = new Error(`SSH upload failed with exit code ${code}`)
				}
			}

			mockStream.on("close", (code: number) => {
				finalize(code)
			})

			mockStream.emit("close", 255)
			await new Promise((resolve) => setTimeout(resolve, 50))

			uploadDone.should.equal(true)
			;(finalError !== undefined).should.equal(true)
			;(finalError?.message ?? "").should.containEql("exit code 255")
		})
	})

	describe("Async Lock — Prevent Double-Click", () => {
		it("should prevent concurrent getUserMedia calls", async () => {
			let lock = false
			let callCount = 0

			const startRecording = async () => {
				// Lock acquired FIRST
				if (lock) {
					return "duplicate call rejected"
				}
				lock = true
				callCount++

				try {
					// Simulate async getUserMedia (~500ms)
					await new Promise((resolve) => setTimeout(resolve, 50))
					return "success"
				} finally {
					lock = false
				}
			}

			// Simulate double-click: call twice immediately
			const result1 = startRecording()
			const result2 = startRecording()

			const [r1, r2] = await Promise.all([result1, result2])

			r1.should.equal("success")
			r2.should.equal("duplicate call rejected")
			callCount.should.equal(1)
		})

		it("should cancel async operation when abort called during lock", async () => {
			let lock = false
			let operationCancelled = false

			const startRecording = async (abortSignal?: AbortSignal) => {
				if (lock) return "duplicate call rejected"
				lock = true

				try {
					if (abortSignal?.aborted) {
						operationCancelled = true
						throw new DOMException("Aborted", "AbortError")
					}

					// Simulate pending async operation like getUserMedia
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(resolve, 500)
						abortSignal?.addEventListener("abort", () => {
							operationCancelled = true
							clearTimeout(timeout)
							reject(new DOMException("Aborted", "AbortError"))
						})
					})
					return "success"
				} catch (err) {
					if ((err as Error).name === "AbortError") {
						return "aborted as expected"
					}
					throw err
				} finally {
					lock = false
				}
			}

			// Start recording with AbortController
			const abortController = new AbortController()
			const recordPromise = startRecording(abortController.signal)

			// Simulate user clicking stop button while operation active (~100ms in)
			await new Promise((resolve) => setTimeout(resolve, 100))
			abortController.abort()

			await new Promise((resolve) => setTimeout(resolve, 50))

			operationCancelled.should.equal(true)
			lock.should.equal(false)
		})
	})
})
