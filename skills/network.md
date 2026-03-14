# Network Skill
SSH and network management for NexusAI.

## Capabilities
- SSH connect/execute/disconnect via `ssh_connect`, `ssh_execute`, `ssh_disconnect` tools
- Network discovery (ARP/mDNS/Nmap), saved connection profiles
- File transfer (SCP/SFTP), persistent sessions, tunnel configuration

## Config Pattern
Servers: `{ name, host, port, user, key }`. Active connections tracked by connection ID.