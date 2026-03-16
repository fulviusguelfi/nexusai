import { describe, it } from "mocha"
import "should"
import { DeviceProtocol, DeviceType } from "@shared/iot/DeviceProfile"
import { DeviceIdentificationService } from "../DeviceIdentificationService"

describe("DeviceIdentificationService", () => {
	describe("identifyFromMdnsType()", () => {
		it("identifies SSH-capable devices from _ssh service type", () => {
			const result = DeviceIdentificationService.identifyFromMdnsType("_ssh")
			result.type.should.equal(DeviceType.COMPUTER)
			result.protocol.should.equal(DeviceProtocol.SSH)
		})

		it("identifies MQTT sensor from _mqtt service type", () => {
			const result = DeviceIdentificationService.identifyFromMdnsType("_mqtt")
			result.type.should.equal(DeviceType.MQTT_SENSOR)
			result.protocol.should.equal(DeviceProtocol.MQTT)
		})

		it("identifies smart bulb from _hap service type", () => {
			const result = DeviceIdentificationService.identifyFromMdnsType("_hap")
			result.type.should.equal(DeviceType.SMART_BULB)
		})

		it("identifies smart speaker from airplay service type", () => {
			const result = DeviceIdentificationService.identifyFromMdnsType("airplay")
			result.type.should.equal(DeviceType.SMART_SPEAKER)
		})

		it("falls back to UNKNOWN type for unrecognized service", () => {
			const result = DeviceIdentificationService.identifyFromMdnsType("_xyzzy")
			result.type.should.equal(DeviceType.UNKNOWN)
			result.protocol.should.equal(DeviceProtocol.UNKNOWN)
		})
	})

	describe("identifyFromVendor()", () => {
		it("identifies Philips bulb from vendor name", () => {
			const type = DeviceIdentificationService.identifyFromVendor("Philips Lighting")
			type.should.equal(DeviceType.SMART_BULB)
		})

		it("identifies smart speaker from Sonos vendor", () => {
			const type = DeviceIdentificationService.identifyFromVendor("Sonos Inc.")
			type.should.equal(DeviceType.SMART_SPEAKER)
		})

		it("returns UNKNOWN for unrecognized vendor", () => {
			const type = DeviceIdentificationService.identifyFromVendor("ACME Corp")
			type.should.equal(DeviceType.UNKNOWN)
		})
	})
})
