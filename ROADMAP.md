# NexusAI Roadmap

## Versão 1.0.0 - Alpha
**Status**: 📋 Planejamento

### ✅ Concluído
- [x] Repositório criado
- [x] Branches configuradas (master, develop)
- [x] Documentação inicial (PLAN.md, CRONOGRAMA.md)
- [x] Skills base criadas
- [x] Renomeação inicial para NexusAI (metadados e README base)

### 📋 Em Andamento
- [ ] Revisão e merge do PR #1

### ⏳ Próximas Tarefas

#### Fase 1: Fundação
- [x] Renomear projeto para NexusAI (package.json, etc.)
- [x] Atualizar identidade visual
- [x] Configurar autores e licença (Apache-2.0 mantida por ser fork; NOTICE e autoria configurados)
- [x] Preparar estrutura documental base

#### Fase 1: Fundação
- [x] Renomear projeto para NexusAI (package.json, etc.)
- [x] Atualizar identidade visual
- [x] Configurar autores e licença (Apache-2.0 mantida por ser fork; NOTICE e autoria configurados)
- [x] Preparar estrutura documental base

#### Fase 2: Controle Local ✅ Concluída (`2026-03-11`)
- [x] Renomear ClineError → NexusError / ClineAuthProvider → NexusAuthProvider (barrels de retrocompatibilidade)
- [x] Corrigir nome de pacote CLI (`@nexusai/cli`)
- [x] Testes unitários GitHubAuthService (12 testes)
- [x] Ferramenta `list_processes` (spec + handler + 12 variantes de prompt)
- [x] Ferramenta `kill_process` (spec + handler + 12 variantes de prompt)
- [x] Puppeteer lazy-load (import dinâmico em BrowserSession.ts)
- [x] Suite E2E Playwright — todos os testes passando (mock server, auth flow, diff editor, chat, editor)
- [x] E2E cobertura — terminal tools: `terminal.test.ts` (list_processes, execute_command, kill_process)
	- [x] E2E cobertura — retry: `checkpoint.test.ts` (botão Retry após api_req_failed)

#### Fase 3: SSH ✅ Concluída (`2026-03-13`)
- [x] Ferramenta `discover_network_hosts` (spec + handler + 12 variantes de prompt)
- [x] Ferramenta `ssh_connect` (spec + handler + aprovação do usuário)
- [x] Ferramenta `ssh_execute` (spec + handler + requires_approval)
- [x] Ferramenta `ssh_upload` (spec + handler + SFTP fastPut)
- [x] Ferramenta `ssh_download` (spec + handler + SFTP fastGet)
- [x] Ferramenta `ssh_disconnect` (spec + handler + SshSessionRegistry)
- [x] E2E cobertura — SSH tools: `ssh.test.ts` (7 cenários, 26 testes, Exit Code: 0)
- [x] `SshSessionRegistry` — gerenciamento por taskId
- [x] MockSshServer — ESM/CJS interop, pkcs1, force-close connections
- [x] Bug fix: ssh2 bundled via esbuild (nativeNodePlugin); ECONNRESET resolvido
- [x] Bug documentado: ESM/CJS interop pattern (#22)
- [x] Skill criada: `skills/playwright-e2e.md`
- [ ] Integrar com interface (webview: exibir sessão SSH ativa) — registrado como pendência

#### Fase 4: IoT
- [ ] Ferramenta `mqtt_publish` (spec + handler)
- [ ] Ferramenta `mqtt_subscribe` (spec + handler)
- [ ] Ferramenta `mdns_discover` (spec + handler — descoberta de dispositivos)
- [ ] Ferramenta `http_request` para dispositivos HTTP locais
- [ ] Interface de controle IoT na webview
- [ ] E2E cobertura — IoT tools

#### Fase 5: Voz ✅ Concluída (via Fase 6 — `2026-03-30`)
- [x] Integrar Piper (TTS)
- [x] Integrar Whisper (STT)
- [x] Avatar interativo (lip sync, SVG 2D, framer-motion) — entregue na Fase 6
- [x] Sistema de detecção de locutor (SpeakerGate) — entregue na Fase 6
- [x] Personalidade configurável (tom, modo de resposta, nome) — entregue na Fase 6

#### Fase 6: Avatar Animado + Lip Sync ✅ Concluída (`2026-03-30`)
- [x] 6.1 SpeakerGate — bloqueia STT durante reprodução TTS (evita loop de feedback)
- [x] 6.2 AvatarOverlay + AvatarSvg — componente SVG 2D inline, framer-motion, 9 visemas
- [x] 6.3 RhubarbService + LipSyncController — extração de fonemas WASM, RAF loop, timing sync
- [x] 6.4 Personalidade — voice_behavior.ts com tom/modo/nome, settings UI "Avatar & Personalidade"
- [x] 6.5 Integração, snapshots, docs, 46+ novos testes (total ~1450+)

#### Fase 7: Agentes Autônomos
- [ ] Multi-IA (usar outras IAs como ferramentas)
- [ ] Agent loop autônomo
- [ ] Memory persistente entre sessões

---

## Modelo de Contribuição

### Branches
- `master` - Releases estáveis
- `develop` - Integração contínua
- `feat/*` - Novas funcionalidades

### Commits
```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
refactor: refatoração
test: testes
```

### Pull Requests
- Sempre a partir de uma branch feature
- targeted à branch develop
- Descrição clara do que foi feito
- Link para issue relacionada

---

## Contato

- **Autor**: Fulvius Titanero Guelfi
- **GitHub**: https://github.com/fulviusguelfi/nexusai
- **Issues**: https://github.com/fulviusguelfi/nexusai/issues
