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

#### Fase 3: SSH
- [x] Ferramenta `discover_network_hosts` (spec + handler + 12 variantes de prompt)
- [x] Ferramenta `ssh_connect` (spec + handler + aprovação do usuário)
- [x] Ferramenta `ssh_execute` (spec + handler + requires_approval)
- [x] Ferramenta `ssh_upload` (spec + handler + SFTP fastPut)
- [x] Ferramenta `ssh_download` (spec + handler + SFTP fastGet)
- [x] Ferramenta `ssh_disconnect` (spec + handler + SshSessionRegistry)
- [ ] E2E cobertura — SSH tools: `ssh.test.ts` (remover test.skip após instalar ssh2)
- [ ] Integrar com interface (webview: exibir sessão SSH ativa)

#### Fase 4: Voz
- [ ] Integrar Piper (TTS)
- [ ] Integrar Whisper (STT)
- [ ] Avatar interativo
- [ ] Sistema de detecção de locutor

#### Fase 5: IoT
- [ ] Descoberta de dispositivos
- [ ] Protocolo MQTT
- [ ] Protocolo HTTP
- [ ] Interface de controle

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
