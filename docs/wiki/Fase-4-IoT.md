# Fase 4 — IoT (MQTT, HTTP, Operação de Dispositivos) ✅

> **Status**: Concluída  
> **Branch**: `feat/fase-4-iot` → PR para `develop`

A Fase 4 entregou controle de dispositivos IoT com 8 ferramentas novas, MockMqttBroker para E2E, integração com o painel de sessões SSH/MQTT existente e cobertura completa de testes unitários e E2E.

---

## Sumário

- [Ferramentas Implementadas](#ferramentas-implementadas)
- [Arquitetura IoT](#arquitetura-iot)
- [Serviços e Registries](#serviços-e-registries)
- [SSRF Guard](#ssrf-guard)
- [Testes E2E](#testes-e2e)
- [Testes Unitários](#testes-unitários)
- [Issues Relacionados](#issues-relacionados)

---

## Ferramentas Implementadas

| Ferramenta | Handler | Descrição |
|---|---|---|
| `discover_devices` | `DiscoverDevicesToolHandler` | Varre a rede local via mDNS/Bonjour + SSDP (UDP multicast) + ARP table (timeout configurável) |
| `register_device` | `RegisterDeviceToolHandler` | Cadastra dispositivo no `DeviceRegistry` com ip, tipo, protocolo e flags |
| `get_device_info` | `GetDeviceInfoToolHandler` | Lista todos ou busca por `id`/`ip` |
| `http_request` | `HttpRequestToolHandler` | Realiza requisições HTTP com guarda SSRF (IPs privados bloqueados por padrão) |
| `mqtt_connect` | `MqttConnectToolHandler` | Abre sessão MQTT via mqtt.js, persiste em `MqttConnectionRegistry` |
| `mqtt_publish` | `MqttPublishToolHandler` | Publica mensagem em tópico (QoS 0 ou 1) |
| `mqtt_subscribe` | `MqttSubscribeToolHandler` | Assina tópico e coleta mensagens por janela de tempo |
| `mqtt_disconnect` | `MqttDisconnectToolHandler` | Encerra sessão MQTT e atualiza registry |
| `operate_device` | `OperateDeviceToolHandler` | Despacha comando natural para protocolo MQTT, HTTP ou SSH via `DeviceCommandAdapter` |

Todas seguem o padrão: `say("tool", JSON.stringify({ tool: "nome_ferramenta", content: resultado }))`.

---

## Arquitetura IoT

### Descoberta de Dispositivos (`IotDiscoveryService`)

`scan(timeoutMs?)` executa três métodos em paralelo via `Promise.allSettled`, o que garante que a falha de um não bloqueia os outros, e mergeia os resultados por IP:

| Método | Protocolo | Detalhes |
|---|---|---|
| `scanViaMdns()` | mDNS/Bonjour | Usa `bonjour-service`; identifica tipo via `DeviceIdentificationService` (ex.: `_googlecast`, `_sonos`, `_hap`) |
| `scanViaSsdp()` | SSDP/UPnP | UDP multicast 239.255.255.250:1900; M-SEARCH; parseia headers `SERVER`/`ST`/`USN`; retorna `DeviceProtocol.UPNP` |
| `scanViaArp()` | ARP (passivo) | `arp -a` via `child_process`; parseia IP + MAC; filtra broadcast; retorna `DeviceType.UNKNOWN` para enriquecimento posterior |

`DeviceIdentificationService.identifyFromMdnsType()` reconhece tipos: `_googlecast`/`_sonos` → `SMART_SPEAKER`; `_tuya`/`_homekit` → `SMART_BULB`; `_printer` → `PRINTER`; `_ssh` → `COMPUTER`; etc.

### Camadas

```
OperateDeviceToolHandler
    └─ DeviceCommandAdapter
            ├─ executeMqtt  →  MqttConnectionRegistry.get(cwd)  →  client.publish(topic, payload)
            ├─ executeHttp  →  http/https.request(baseUrl + path, body)
            └─ executeSsh   →  SshSessionRegistry.get(cwd)      →  client.exec(shellCmd)
```

### Fluxo típico — MQTT

```typescript
// 1. Registrar dispositivo
register_device { name: "Sensor1", ip: "192.168.1.10", protocol: "MQTT", capabilities: ["devices/sensor1/cmd"] }

// 2. Conectar ao broker
mqtt_connect { broker: "mqtt://192.168.1.1:1883", client_id: "nexusai" }

// 3. Operar
operate_device { ip: "192.168.1.10", command: "on" }
// → DeviceCommandAdapter.executeMqtt → publish("devices/sensor1/cmd", {"command":"on",...})
```

### Fluxo típico — HTTP

```typescript
// 1. Registrar dispositivo (capabilities define o baseUrl)
register_device { name: "Bulb", ip: "192.168.1.50", protocol: "HTTP_REST",
                  capabilities: ["http://192.168.1.50:80"], trusted_local: false }

// 2. Operar
operate_device { ip: "192.168.1.50", command: "on" }
// → DeviceCommandAdapter.executeHttp → PUT http://192.168.1.50:80/api/lights/1/state {"on":true}
```

### Fluxo típico — SSH

```typescript
// 1. Registrar
register_device { name: "Pi", ip: "192.168.1.20", protocol: "SSH" }

// 2. Conectar (reutiliza sessão Phase 3)
ssh_connect { host: "192.168.1.20", port: 22, user: "pi", auth_method: "password", password: "..." }

// 3. Operar
operate_device { ip: "192.168.1.20", command: "status" }
// → mapCommandToShell(COMPUTER, "status") → "uptime"
// → SshSessionRegistry.get(cwd).exec("uptime")
```

---

## Serviços e Registries

### DeviceRegistry (`src/services/iot/DeviceRegistry.ts`)

Singleton global. Persiste entre tool calls dentro da mesma sessão VS Code.

```typescript
DeviceRegistry.register(device: DeviceProfile)   // gera device-${Date.now()} como ID
DeviceRegistry.getAll(): DeviceProfile[]
DeviceRegistry.getById(id: string): DeviceProfile | undefined
DeviceRegistry.getByIp(ip: string): DeviceProfile | undefined
DeviceRegistry.clear()
```

### MqttConnectionRegistry (`src/services/iot/MqttConnectionRegistry.ts`)

Sessões MQTT por `taskId` (= `config.cwd`).

```typescript
MqttConnectionRegistry.set(cwd, client)
MqttConnectionRegistry.get(cwd)           // retornado por operate_device
MqttConnectionRegistry.delete(cwd)
MqttConnectionRegistry.getActiveSessions(): MqttSessionInfo[]
```

### DeviceCommandAdapter (`src/services/iot/DeviceCommandAdapter.ts`)

Traduz comando natural para ação de protocolo.  
`mapCommandToShell(type, command)` — COMPUTER + "status" → `"uptime"`.  
`mapCommandToHttpEndpoint(type, command)` — SMART_BULB + "on" → `PUT /api/lights/1/state {on:true}`.  
Fallback genérico — `POST /command {command}`.

---

## SSRF Guard

`HttpRequestToolHandler` bloqueia IPs privados (127.x, 10.x, 192.168.x, 172.16-31.x, 169.254.x, IPv6 ::1/fd00::/8) por padrão.

Para permitir acesso local, registre o dispositivo com `trustedLocal: true`:

```typescript
register_device { ip: "127.0.0.1", trusted_local: true }
// Agora http_request para 127.0.0.1 passa pelo guard
```

O caminho `operate_device → DeviceCommandAdapter.executeHttp` **não** passa pelo SSRF guard — acessa diretamente a URL contida em `capabilities`.

---

## Testes E2E

### MockMqttBroker

`src/test/e2e/fixtures/mqtt-broker/index.ts`

Broker TCP MQTT 3.1.1 mínimo usando `node:net` (sem dependência externa).

- `start(port = 1884)` / `stop()`
- Suporta: CONNECT→CONNACK, PUBLISH QoS 0/1→PUBACK, SUBSCRIBE→SUBACK, PINGREQ→PINGRESP, DISCONNECT→close
- `publishedMessages: Array<{topic, payload}>` para asserções nos testes
- Porta 1884 (não 1883) para evitar conflito com broker local

```typescript
const mqttBroker = new MockMqttBroker()
e2e.beforeAll(async () => await mqttBroker.start(1884))
e2e.afterAll(async () => await mqttBroker.stop())
// após o teste: mqttBroker.publishedMessages para asserções
```

### Cenários cobertos em `iot.test.ts`

| # | Keyword | Ferramenta(s) | Asserção |
|---|---|---|---|
| 1 | `iot_discover_devices_request` | `discover_devices` | "No devices discovered" |
| 2 | `iot_register_device_request` | `register_device` | "TestBulb" |
| 3 | `iot_get_all_devices_request` | `register_device` → `get_device_info` | "BulbAlpha" |
| 4 | `iot_get_by_ip_request` | `register_device` → `get_device_info` | "SensorBeta" |
| 5 | `iot_http_ssrf_request` | `http_request` (bloqueado) | "SSRF" |
| 6 | `iot_http_trusted_request` | `register_device` → `http_request` | "200" |
| 7 | `iot_mqtt_connect_request` | `mqtt_connect` | "1884" |
| 8 | `iot_mqtt_publish_request` | `mqtt_connect` → `mqtt_publish` | "test/e2e" |
| 9 | `iot_mqtt_subscribe_request` | `mqtt_connect` → `mqtt_subscribe` | "timeout" |
| 10 | `iot_mqtt_disconnect_request` | `mqtt_connect` → `mqtt_disconnect` | "mqtt_disconnect" |
| 11 | `iot_operate_mqtt_request` | `register_device` → `mqtt_connect` → `operate_device` | "MqttSensor1" |
| 12 | `iot_operate_http_request` | `register_device` → `operate_device` (HTTP) | "LocalHttpDevice" |
| 13 | `iot_operate_ssh_request` | `register_device` → `ssh_connect` → `operate_device` (SSH) | "SshComputer" |

### Infraestrutura do mock server

- **`fixtures/server/api.ts`**: constantes `E2E_IOT_MOCK_API_RESPONSES` com 34 strings de resposta mock
- **`fixtures/server/index.ts`**: roteamento IoT dentro do handler `POST /chat/completions` — detecta keywords e tags de fechamento (`</register_device>`, `</mqtt_connect>`, etc.) para determinar o turno
- **Endpoint `/command`**: adicionado ao mock server para `operate_device` HTTP path (POST → `{"result":"ok","status":"up"}`)

---

## Testes Unitários

Todos os handlers e serviços IoT têm cobertura unitária em `src/services/iot/__tests__/`:

| Arquivo de teste | Cobertura |
|---|---|
| `DeviceRegistry.test.ts` | register, getAll, getById, getByIp, clear, duplicatas |
| `DeviceCommandAdapter.test.ts` | MQTT/HTTP/SSH paths, mapCommandToShell, mapCommandToHttpEndpoint |
| `MqttConnectionRegistry.test.ts` | set, get, has, delete, getActiveSessions, onDidChange |
| `DiscoverDevicesToolHandler.test.ts` | timeout, lista vazia, lista com dispositivos |
| `RegisterDeviceToolHandler.test.ts` | ID gerado, campos obrigatórios, trustedLocal |
| `GetDeviceInfoToolHandler.test.ts` | list all, by id, by ip, not found |
| `HttpRequestToolHandler.test.ts` | GET/POST, SSRF block, SSRF bypass trustedLocal |
| `MqttConnectToolHandler.test.ts` | connect, duplicate connect, cleanup |
| `MqttPublishToolHandler.test.ts` | QoS 0/1, no session error |
| `MqttSubscribeToolHandler.test.ts` | timeout, messages collected |
| `MqttDisconnectToolHandler.test.ts` | success, no session |
| `OperateDeviceToolHandler.test.ts` | MQTT/HTTP/SSH paths, device not found |

**1279 testes unitários passando**, 1 pendente.

---

## Issues Relacionados

- Fase 4 kickoff e planejamento: `PLAN.md` STOP POINT #2
- Integração com painel de sessões SSH/MQTT: `src/integrations/editor/DiffViewProvider.ts` (não modificado)
- SSRF guard: `src/core/task/tools/handlers/HttpRequestToolHandler.ts`
