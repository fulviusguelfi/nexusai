# Network Skill
SSH and network management for NexusAI.

## Available SSH Tools
| Tool | Description |
|---|---|
| `ssh_connect` | Open SSH session. Returns `connectionId`. Requires user approval. |
| `ssh_execute` | Run a command on a connected session |
| `ssh_upload` | Upload file via SFTP (fastPut) |
| `ssh_download` | Download file via SFTP (fastGet) |
| `ssh_disconnect` | Close session and free resources |
| `discover_network_hosts` | ARP/mDNS/Nmap scan for alive hosts on subnet |

## Connection Profile Pattern
```json
{
  "name": "prod-server",
  "host": "192.168.1.100",
  "port": 22,
  "username": "deploy",
  "privateKeyPath": "/home/user/.ssh/id_rsa"
}
```
Password auth also supported via `password` field.

## Typical SSH Workflow
```
ssh_connect  → connectionId
ssh_execute  → stdout/stderr
ssh_upload   → file transfer
ssh_disconnect
```

## Sessions
Active sessions tracked by `SshSessionRegistry` per `taskId`.
All sessions are visible in Activity Bar under `nexusai.sshPanel`.

## Network Discovery
`discover_network_hosts` returns `{ ip, hostname, openPorts, latencyMs }`.
Use to find SSH targets before connecting.

## Security Notes
- `ssh_execute` has `requires_approval: true` — always shown to user before execution
- Private key content accepted via `private_key_content` param (not stored to disk)
- SFTP transfers validated against path traversal