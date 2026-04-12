import Section from "../Section"

interface AboutSectionProps {
	version: string
	renderSectionHeader: (tabId: string) => JSX.Element | null
}
const AboutSection = ({ version, renderSectionHeader }: AboutSectionProps) => {
	return (
		<div>
			{renderSectionHeader("about")}
			<Section>
				<div className="flex px-4 flex-col gap-4">
					<div>
						<h2 className="text-lg font-semibold mb-1">NexusAI v{version}</h2>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">
							Um assistente de desenvolvimento de software autônomo, construído do zero por Inteligência Artificial.
						</p>
					</div>

					<p className="text-sm">
						NexusAI é um agente de IA que opera dentro do VS Code e pode criar e editar arquivos, explorar grandes
						bases de código, executar comandos no terminal, usar o browser e muito mais — tudo com sua supervisão e
						aprovação. Projetado para lidar com tarefas complexas de desenvolvimento passo a passo, sem sair do seu
						editor.
					</p>

					<div className="flex flex-col gap-1">
						<h3 className="text-sm font-semibold">Feito completamente por IA</h3>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">
							Todo o código, arquitetura, testes e documentação deste projeto foram gerados e revisados por modelos
							de Inteligência Artificial. NexusAI é, em si mesmo, uma demonstração prática do que a IA é capaz de
							construir.
						</p>
					</div>

					<div className="flex flex-col gap-2">
						<h3 className="text-sm font-semibold">Links</h3>
						<div className="flex flex-col gap-1 text-sm">
							<a
								className="text-[var(--vscode-textLink-foreground)] hover:underline"
								href="https://github.com/nexus-ai-dev/nexusai"
								rel="noopener noreferrer"
								target="_blank">
								⭐ Repositório no GitHub
							</a>
							<a
								className="text-[var(--vscode-textLink-foreground)] hover:underline"
								href="https://github.com/nexus-ai-dev/nexusai/wiki"
								rel="noopener noreferrer"
								target="_blank">
								📖 Wiki & Documentação
							</a>
							<a
								className="text-[var(--vscode-textLink-foreground)] hover:underline"
								href="https://github.com/nexus-ai-dev/nexusai/issues"
								rel="noopener noreferrer"
								target="_blank">
								🐛 Reportar um problema
							</a>
							<a
								className="text-[var(--vscode-textLink-foreground)] hover:underline"
								href="https://github.com/nexus-ai-dev/nexusai/blob/main/CHANGELOG.md"
								rel="noopener noreferrer"
								target="_blank">
								📋 Changelog
							</a>
						</div>
					</div>

					<p className="text-xs text-[var(--vscode-descriptionForeground)] border-t border-[var(--vscode-panel-border)] pt-3">
						Baseado no projeto open-source{" "}
						<a
							className="text-[var(--vscode-textLink-foreground)] hover:underline"
							href="https://github.com/cline/cline"
							rel="noopener noreferrer"
							target="_blank">
							Cline
						</a>
						. Distribuído sob a licença Apache 2.0.
					</p>
				</div>
			</Section>
		</div>
	)
}

export default AboutSection
