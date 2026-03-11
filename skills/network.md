# Network Skill

## Descrição
Esta skill permite o gerenciamento de conexões de rede, incluindo SSH para máquinas remotas, descoberta de dispositivos na rede local, e configuração de rede.

## Quando Usar
- Quando o usuário precisar conectar a servidores remotos
- Para descobrir dispositivos na rede
- Para executar comandos em máquinas remotas
- Para gerenciar conexões SSH
- Para troubleshooting de rede

## Funcionalidades

### SSH (Secure Shell)
- Conexão a servidores remotos
- Execução de comandos
- Transferência de arquivos (SCP/SFTP)
- Gerenciamento de chaves SSH
- Múltiplas conexões simultâneas

### Descoberta de Rede
- Varredura de rede local (ARP/Nmap)
- Detecção de dispositivos (mDNS/Bonjour)
- Identificação de serviços
- Mapa de rede

### Gerenciamento de Conexões
- Lista de conexões salvas
- Histórico de comandos
- Sessões persistentes
- Configuração de túnel

## Comandos
- `conectar ssh` - Estabelece conexão SSH
- `executar remoto` - Executa comando em servidor
- `listar conexoes` - Mostra conexões ativas
- `descoberta rede` - Varre rede local
- `adicionar servidor` - Salva configuração de servidor

## Estrutura de Configuração

### Servidores
```json
{
  "servidores": [
    {
      "nome": "servidor-web",
      "host": "192.168.1.100",
      "porta": 22,
      "usuario": "admin",
      "chave": "~/.ssh/id_rsa"
    }
  ]
}
```

## Exemplos

### Conectar via SSH
```
Usuário: "Conecta no servidor de produção"
IA: Estabelece conexão SSH usando credenciais salvas
```

### Executar Comando Remoto
```
Usuário: "Lista os processos no servidor"
IA: Executa comando via SSH e retorna resultado
```

### Descobrir Dispositivos
```
Usuário: "Quais dispositivos tem na rede?"
IA: Varre a rede local e lista dispositivos encontrados
```

## Notas de Segurança
- Nunca expõe senhas em logs
- Usa chaves SSH quando possível
- Armazena credenciais de forma segura
- Suporta MFA/2FA

## Integrações
- OpenSSH
- libssh2
- Nmap
- mDNS/Bonjour
