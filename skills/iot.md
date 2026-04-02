# IoT Skill
Control and discover IoT devices on the local network.

## Available Tools
| Tool | Description |
|---|---|
| `discover_devices` | mDNS/ARP/SSDP scan for devices on local network |
| `register_device` | Save a device profile to the registry |
| `get_device_info` | Retrieve registered device details |
| `http_request` | HTTP/REST calls to local devices (SSRF-guarded, use `trusted_local: true` for LAN) |
| `mqtt_connect` | Connect to MQTT broker |
| `mqtt_publish` | Publish a message to a topic |
| `mqtt_subscribe` | Subscribe and listen to a topic |
| `mqtt_disconnect` | Disconnect from broker |
| `operate_device` | High-level command dispatch (auto-selects MQTT/HTTP/SSH per device protocol) |

## Device Config Pattern
```json
{
  "id": "light-kitchen",
  "name": "Kitchen Light",
  "type": "light",
  "protocol": "mqtt",
  "broker": "mqtt://192.168.1.10:1883",
  "topic": "home/kitchen/light"
}
```
For HTTP devices: use `url` and `endpoint` instead of `broker` and `topic`.

## Protocols
- **MQTT** — pub/sub, best for sensors and actuators
- **HTTP/REST** — request/response, best for devices with web APIs
- **WebSocket** — real-time bidirectional (use `http_request` with ws upgrade)
- **SSH** — for embedded Linux devices (use SSH tools from network skill)

## Discovery
- mDNS/Bonjour: services like `_mqtt._tcp`, `_http._tcp`
- ARP scan: finds all IPs on the subnet
- SSDP/UPnP: smart TVs, routers, printers
- Result: list of `{ ip, hostname, services, mac }`

## SSRF Guard
`http_request` blocks private IPs by default. For local devices set `trusted_local: true`.

## IoT Panel
Active devices shown in Activity Bar under `nexusai.iotPanel` (IotDevicesPanelProvider).