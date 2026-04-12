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
				<div className="flex px-4 flex-col gap-2">
					<h2 className="text-lg font-semibold">NexusAI v{version}</h2>
					<p>
						An AI assistant that can use your CLI and Editor. NexusAI can handle complex software development tasks
						step-by-step with tools that let it create & edit files, explore large projects, use the browser, and
						execute terminal commands (after you grant permission).
					</p>
				</div>
			</Section>
		</div>
	)
}

export default AboutSection
