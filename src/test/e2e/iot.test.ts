import { expect } from "@playwright/test"
import { MockMqttBroker } from "./fixtures/mqtt-broker"
import { MockSshServer } from "./fixtures/ssh-server"
import { E2ETestHelper, e2e } from "./utils/helpers"

// Phase 4 — IoT Tools
//
// All handlers are in src/core/task/tools/handlers/ and the service layer lives in
// src/services/iot/.  Mock server keyword → LLM response mappings are in
// fixtures/server/api.ts (E2E_IOT_MOCK_API_RESPONSES) and fixtures/server/index.ts.
//
// Each `e2e(...)` call gets a fresh VS Code instance with an empty globalState, so
// no device-registry or session state leaks between tests.

const mqttBroker = new MockMqttBroker()
const sshServer = new MockSshServer()

e2e.describe("IoT Tools", () => {
	e2e.beforeAll(async () => {
		// MQTT broker on 1884 (avoid conflicts with default 1883)
		await mqttBroker.start(1884)
		// SSH server on 2222 (shared – same port as SSH phase tests)
		await sshServer.start(2222)
	})

	e2e.afterAll(async () => {
		await mqttBroker.stop()
		await sshServer.stop()
	})

	// Reset accumulated credentials/handlers between tests to prevent state bleeding.
	e2e.beforeEach(() => {
		sshServer.reset()
	})

	// ── 1 ─────────────────────────────────────────────────────────────────────────
	e2e("discover_devices — mDNS scan completes, chat reports no devices", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await expect(inputbox).toBeVisible()
		await inputbox.fill("iot_discover_devices_request")
		await sidebar.getByTestId("send-button").click()

		// Completion: "discover_devices complete. No devices discovered."
		await E2ETestHelper.waitForChatMessage(sidebar, "No devices discovered", 60_000)
	})

	// ── 2 ─────────────────────────────────────────────────────────────────────────
	e2e("register_device — registers TestBulb, chat confirms", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_register_device_request")
		await sidebar.getByTestId("send-button").click()

		// Completion: "Device TestBulb registered at 192.168.99.1."
		await E2ETestHelper.waitForChatMessage(sidebar, "TestBulb", 60_000)
	})

	// ── 3 ─────────────────────────────────────────────────────────────────────────
	e2e("get_device_info — list all devices, chat shows BulbAlpha", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_get_all_devices_request")
		await sidebar.getByTestId("send-button").click()

		// Turn 1: register BulbAlpha  →  Turn 2: list all  →  Completion: "BulbAlpha at 192.168.88.1"
		await E2ETestHelper.waitForChatMessage(sidebar, "BulbAlpha", 60_000)
	})

	// ── 4 ─────────────────────────────────────────────────────────────────────────
	e2e("get_device_info — query by IP, chat shows SensorBeta", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_get_by_ip_request")
		await sidebar.getByTestId("send-button").click()

		// Turn 1: register SensorBeta  →  Turn 2: get by ip  →  Completion: "SensorBeta at 192.168.88.2"
		await E2ETestHelper.waitForChatMessage(sidebar, "SensorBeta", 60_000)
	})

	// ── 5 ─────────────────────────────────────────────────────────────────────────
	e2e("http_request — SSRF guard blocks private IP 10.0.0.1", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_http_ssrf_request")
		await sidebar.getByTestId("send-button").click()

		// Completion: "http_request SSRF protection blocked the request to 10.0.0.1."
		await E2ETestHelper.waitForChatMessage(sidebar, "SSRF", 60_000)
	})

	// ── 6 ─────────────────────────────────────────────────────────────────────────
	e2e("http_request — trusted local device bypasses SSRF, returns 200", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_http_trusted_request")
		await sidebar.getByTestId("send-button").click()

		// Turn 1: register LocalHealthEndpoint (trustedLocal=true)
		// Turn 2: GET http://127.0.0.1:7777/health/  →  mock server returns 200
		// Completion: "http_request GET http://127.0.0.1:7777/health/ returned status 200."
		await E2ETestHelper.waitForChatMessage(sidebar, "200", 60_000)
	})

	// ── 7 ─────────────────────────────────────────────────────────────────────────
	e2e("mqtt_connect — connects to mock broker on port 1884", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_mqtt_connect_request")
		await sidebar.getByTestId("send-button").click()

		// Completion: "mqtt_connect established connection to 127.0.0.1:1884."
		await E2ETestHelper.waitForChatMessage(sidebar, "1884", 60_000)
	})

	// ── 8 ─────────────────────────────────────────────────────────────────────────
	e2e("mqtt_publish — publishes message to topic test/e2e", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_mqtt_publish_request")
		await sidebar.getByTestId("send-button").click()

		// Turn 1: mqtt_connect  →  Turn 2: mqtt_publish  →  Completion: "mqtt_publish sent message to topic test/e2e."
		await E2ETestHelper.waitForChatMessage(sidebar, "test/e2e", 60_000)
	})

	// ── 9 ─────────────────────────────────────────────────────────────────────────
	e2e("mqtt_subscribe — subscribe window closes after timeout, 0 messages", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_mqtt_subscribe_request")
		await sidebar.getByTestId("send-button").click()

		// Turn 1: mqtt_connect  → Turn 2: mqtt_subscribe (1500 ms timeout)
		// Completion: "mqtt_subscribe completed — timeout reached, 0 messages collected."
		await E2ETestHelper.waitForChatMessage(sidebar, "timeout", 60_000)
	})

	// ── 10 ────────────────────────────────────────────────────────────────────────
	e2e("mqtt_disconnect — closes MQTT session gracefully", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_mqtt_disconnect_request")
		await sidebar.getByTestId("send-button").click()

		// Turn 1: mqtt_connect  →  Turn 2: mqtt_disconnect
		// Completion: "mqtt_disconnect closed the MQTT session."
		await E2ETestHelper.waitForChatMessage(sidebar, "mqtt_disconnect", 60_000)
	})

	// ── 11 ────────────────────────────────────────────────────────────────────────
	e2e("operate_device — MQTT path: register, connect, publish command to MqttSensor1", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_operate_mqtt_request")
		await sidebar.getByTestId("send-button").click()

		// Turn 1: register MqttSensor1 (192.168.88.10, MQTT)
		// Turn 2: mqtt_connect to 127.0.0.1:1884
		// Turn 3: operate_device ip=192.168.88.10 command="on"  → publishes via MQTT
		// Completion: 'operate_device MQTT path: command "on" sent to MqttSensor1 via MQTT.'
		await E2ETestHelper.waitForChatMessage(sidebar, "MqttSensor1", 60_000)
	})

	// ── 12 ────────────────────────────────────────────────────────────────────────
	e2e("operate_device — HTTP path: register LocalHttpDevice, POST /command, chat confirms", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("iot_operate_http_request")
		await sidebar.getByTestId("send-button").click()

		// Turn 1: register LocalHttpDevice (127.0.0.1, HTTP_REST, trustedLocal=true, capabilities=http://127.0.0.1:7777)
		// Turn 2: operate_device ip=127.0.0.1 command="status"  → POST http://127.0.0.1:7777/command
		// Completion: 'operate_device HTTP path: command "status" dispatched to LocalHttpDevice.'
		await E2ETestHelper.waitForChatMessage(sidebar, "LocalHttpDevice", 60_000)
	})

	// ── 13 ────────────────────────────────────────────────────────────────────────
	e2e(
		"operate_device — SSH path: register SshComputer, ssh_connect, run uptime via operate_device",
		async ({ helper, sidebar }) => {
			sshServer.acceptPassword("testuser", "testpass")
			sshServer.onExecute("uptime", (ch) => {
				ch.write("up 1 day, 2 hours\n")
				ch.exit(0)
				ch.end()
			})

			await helper.signin(sidebar)

			const inputbox = sidebar.getByTestId("chat-input")
			await inputbox.fill("iot_operate_ssh_request")
			await sidebar.getByTestId("send-button").click()

			// Turn 1: register SshComputer (192.168.88.20, SSH)
			// Turn 2: ssh_connect to 127.0.0.1:2222 (password auth)
			// Turn 3: operate_device ip=192.168.88.20 command="status"  → mapCommandToShell → "uptime"
			// Completion: 'operate_device SSH path: "status" executed on SshComputer via SSH.'
			await E2ETestHelper.waitForChatMessage(sidebar, "SshComputer", 60_000)
		},
	)
})
