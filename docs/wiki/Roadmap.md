# Roadmap — NexusAI v1.0

> Este documento detalha o que está planejado para cada fase do desenvolvimento.
> Para o que já foi entregue, veja [Fase 1 — Fundação](Fase-1-Fundacao.md).

---

## Resumo das Fases

| Fase | Nome | Versão Alvo | Status |
| ---- | ---- | ----------- | ------ |
| 1 | Fundação | 1.0.0-alpha | ✅ Concluída |
| 2 | Controle Local | 1.0.0-beta | ⏳ Planejada |
| 3 | Conexão SSH | 1.0.0-beta | ⏳ Planejada |
| 4 | Voz (TTS/STT) | 1.0.0-rc | ⏳ Planejada |
| 5 | IoT | 1.0.0-rc | ⏳ Planejada |
| — | Stable | 1.0.0 | ⏳ Planejada |

---

## Fase 2 — Controle Local 🖥️

> **Objetivo**: O agente ganha habilidade de operar o computador em que roda — terminal, processos, sistema de arquivos.

### Contexto

O Cline (base do NexusAI) já possui `execute_command` — uma ferramenta que roda comandos shell. A Fase 2 expande isso com uma visão de terminal vetada, gerenciamento de processos e integração mais profunda com o workspace.

### Tarefas Planejadas

| # | Tarefa | Descrição |
| - | ------ | --------- |
| 2.1 | Adaptar terminal do Cline | Customizar a UX do terminal integrado — histórico, kills de processo, output streaming |
| 2.2 | Comandos shell básicos | Expandir o toolset com `list_processes`, `kill_process`, `get_env`, `set_env` |
| 2.3 | Gerenciamento de processos | Listar processos rodando, monitorar output, iniciar/parar serviços |

### Preview Técnico

A expansão usará o mesmo padrão de tools já existente:

```typescript
// Nova ferramenta: list_processes
// Retorna PIDs, nomes, CPU%, mem% dos processos ativos

// Nova ferramenta: kill_process
// Para um processo pelo PID ou nome
```

A ferramenta `execute_command` será aprimorada com:
- Controle de timeout explícito
- Modo background (processo persiste após o tool return)
- Streaming de output em tempo real para a UI

---

## Fase 3 — Conexão SSH 🔐

> **Objetivo**: O agente alcança outros computadores na rede — executa comandos, transfere arquivos e gerencia conexões remotas.

### Por que SSH?

A maioria dos desenvolvedores trabalha com infraestrutura distribuída: servidores de dev, VMs, Raspberry Pi, NAS, ambientes de staging. Hoje, gerenciar tudo isso exige abrir terminais separados, lembrar IPs e senhas, e mudar de contexto constantemente. Com SSH integrado ao agente, basta dizer "reinicia o servidor de staging" — o NexusAI encontra a máquina, conecta e executa.

### Tarefas Planejadas

| # | Tarefa | Descrição |
| - | ------ | --------- |
| 3.1 | Descoberta de máquinas na rede | Scan da rede local para encontrar hosts com SSH aberto (nmap / ARP scan) |
| 3.2 | Implementar cliente SSH | Integração com `ssh2` (Node.js) — autenticação por senha, chave, agent forwarding |
| 3.3 | Execução remota de comandos | Ferramenta `ssh_execute` — roda comandos em hosts remotos |
| 3.4 | Gerenciamento de conexões | Pool de conexões, timeout, reconexão automática, multi-host |

### Preview da Arquitetura

```
SSHManager (src/services/ssh/)
├── ConnectionPool         → reutiliza conexões abertas
├── HostDiscovery          → scan da rede, cache de hosts conhecidos
├── AuthManager            → gerencia credenciais (keychain, config ~/.ssh/)
└── tools/
    ├── SshExecuteToolHandler
    ├── SshUploadToolHandler
    └── SshDownloadToolHandler
```

```protobuf
// Novo RPC: ssh_execute
message SshExecuteRequest {
  string host = 1;
  string command = 2;
  optional int32 timeout_seconds = 3;
}

message SshExecuteResponse {
  string stdout = 1;
  string stderr = 2;
  int32 exit_code = 3;
}
```

### Segurança

- Credenciais nunca aparecem em logs ou state
- Uso do keychain nativo do OS via `keytar`
- Suporte a `~/.ssh/config` — respeita configurações existentes do usuário
- Confirmação obrigatória antes de executar qualquer comando destrutivo em host remoto

---

## Fase 4 — Voz (TTS/STT) 🎙️

> **Objetivo**: Interagir com o agente por voz — dar comandos falados, ouvir respostas, ter um avatar com personalidade.

### Por que Voz Local?

Soluções de voz em nuvem têm três problemas: latência perceptível, custo por uso e envio de áudio para servidores externos. O NexusAI usa modelos rodando 100% localmente:

- **[Piper](https://github.com/rhasspy/piper)** para TTS — voz sintética com qualidade impressionante, modelos de ~50-70MB
- **[Whisper](https://github.com/openai/whisper)** para STT — reconhecimento de fala com qualidade OpenAI, rodando local via `whisper.cpp`

### O Problema da Auto-Escuta

⚠️ **Desafio técnico crítico**: quando o NexusAI fala, o microfone também pode captar a própria voz e ativar o STT, criando um loop infinito.

Solução planejada:
1. **Gate de áudio**: desativar captura enquanto TTS está rodando
2. **Detecção de locutor (Speaker Diarization)**: identificar se a voz capturada é do usuário ou ecoada pelo agente
3. **Delay adaptativo**: esperar silêncio após o TTS antes de reativar o STT

### Tarefas Planejadas

| # | Tarefa | Descrição |
| - | ------ | --------- |
| 4.1 | Integrar Piper (TTS) | API local para síntese de voz, seleção de voz/idioma |
| 4.2 | Integrar Whisper (STT) | Captura de microfone, transcrição em tempo real |
| 4.3 | Avatar interativo | Visualização animada no webview (reage ao falar/ouvir) |
| 4.4 | Detecção de locutor | Sistema para distinguir voz do usuário da voz do agente |
| 4.5 | Personalidade configurável | Nome, tom, velocidade, idioma, modo de resposta |

### Preview da Arquitetura

```
VoiceEngine (src/services/voice/)
├── TtsService (Piper)
│   ├── synthesize(text): AudioBuffer
│   └── listVoices(): Voice[]
│
├── SttService (Whisper.cpp)
│   ├── startCapture(): Stream<Transcript>
│   └── stopCapture(): void
│
├── SpeakerGate
│   ├── lockDuringPlayback()    → previne auto-escuta
│   └── detectSpeaker(audio)   → enum: USER | AGENT | UNKNOWN
│
└── AvatarController
    ├── setMood(mood: Mood)
    └── animateSpeaking(duration)
```

---

## Fase 5 — IoT 📡

> **Objetivo**: O agente entra no mundo físico — descobre e controla dispositivos na rede local via MQTT, HTTP e WebSocket.

### Casos de Uso

- **"Apaga a luz do escritório"** → encontra o dispositivo Zigbee/Shelly → envia comando MQTT/HTTP
- **"Me diz a temperatura do servidor"** → lê sensor de temperature via MQTT
- **"Liga o ar-condicionado quando minha temperatura corporal subir"** → cria automação com condição

### Tarefas Planejadas

| # | Tarefa | Descrição |
| - | ------ | --------- |
| 5.1 | Descoberta de dispositivos | mDNS, SSDP, scan de rede — cria inventário de dispositivos |
| 5.2 | Protocolo MQTT | Cliente MQTT, subscribe/publish, integração com Home Assistant |
| 5.3 | Protocolo HTTP | Chamadas REST para APIs de dispositivos (Shelly, Sonoff, etc.) |
| 5.4 | Protocolo WebSocket | Conexão persistente para dispositivos com WS (HA, Hue, etc.) |
| 5.5 | Interface de controle IoT | Dashboard no webview — mapa de dispositivos, status, histórico |

### Preview da Arquitetura

```
IoTController (src/services/iot/)
├── DeviceRegistry        → inventário de dispositivos descobertos
├── MqttClient            → pub/sub com broker local (Mosquitto, HA)
├── HttpDeviceClient      → REST para Shelly, Sonoff, Tasmota
├── WsDeviceClient        → WebSocket para Home Assistant, Philips Hue
│
└── tools/
    ├── IotDiscoverToolHandler      → "quais dispositivos tenho na rede?"
    ├── IotControlToolHandler       → "liga/desliga dispositivo X"
    └── IotReadToolHandler          → "qual o estado atual do dispositivo X?"
```

---

## Release 1.0.0 — Stable

Para o release estável, além de todas as fases implementadas:

- [ ] Documentação completa — todos os comandos, todas as ferramentas
- [ ] Cobertura de testes ≥ 80% nas partes críticas
- [ ] Performance baseline — tempo de resposta < 200ms para operações de UI
- [ ] Acessibilidade — A11y no webview
- [ ] Internacionalização (i18n) — PT-BR e EN como idiomas suportados
- [ ] Marketplace — publicação na VS Code Marketplace

---

## O que Não Está no Roadmap v1.0

Algumas capacidades que estão no backlog mas **não** serão priorizadas para a v1.0:

- **Versão Desktop standalone** — o NexusAI existe como extensão VS Code; uma versão Electron standalone é futuro
- **Renomear comandos `cline.*`** — os comandos internos do VS Code mantêm o prefixo `cline` para compatibilidade; renomear seria uma breaking change significativa
- **Multi-agent coordination autônoma** — subagentes já existem via `use_subagents`, mas workflows complexos multi-agente são v2.0
- **Plugin marketplace** — sistema de plugins first-party é pós-v1.0

---

[← Fase 1](Fase-1-Fundacao.md) · [Home](Home.md) · [Contribuindo →](Contribuindo.md)
