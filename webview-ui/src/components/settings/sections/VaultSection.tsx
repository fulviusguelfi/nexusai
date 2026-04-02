import type { UserVaultEntry, VaultEntryType } from "@shared/vault"
import { CopyIcon, PlusIcon, TrashIcon } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { trpc } from "@/services/trpc-client"
import Section from "../Section"

const DEFAULT_VAULT_SYSTEM_PROMPT = `SECURE VAULT — DATA PRIVACY RULES

The user has a local secure vault for sensitive data (passwords, tokens, card numbers, documents).
Vault entries are referenced as [VAULT:uuid] placeholders in the conversation.

Rules you MUST follow:
1. When handling a [VAULT:uuid] token in tool parameters, pass it through unchanged — the extension host will resolve it before execution. Never try to expand or guess the value yourself.
2. If the user shares sensitive information (passwords, card numbers, personal documents, private keys) directly in the chat instead of using the vault, proactively suggest they store it via Settings → Vault and use a [VAULT:uuid] reference instead.
3. Never repeat, log, or include vault values in text responses — only in tool call parameters where strictly necessary.
4. Treat any [VAULT:uuid] pattern as opaque. Do not mention or reference the resolved value in your reply.`

interface Props {
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

const VAULT_TYPE_LABELS: Record<VaultEntryType, string> = {
	password: "Password",
	card: "Card",
	document: "Document",
	text: "Text",
}

const VaultSection: React.FC<Props> = ({ renderSectionHeader }) => {
	const [entries, setEntries] = useState<UserVaultEntry[]>([])
	const [showAddForm, setShowAddForm] = useState(false)
	const [label, setLabel] = useState("")
	const [type, setType] = useState<VaultEntryType>("password")
	const [value, setValue] = useState("")
	const [saving, setSaving] = useState(false)
	const [copiedId, setCopiedId] = useState<string | null>(null)

	// System prompt state
	const [systemPromptText, setSystemPromptText] = useState("")
	const [systemPromptLoaded, setSystemPromptLoaded] = useState(false)
	const [systemPromptSaving, setSystemPromptSaving] = useState(false)
	const systemPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const loadEntries = useCallback(async () => {
		try {
			const result = await trpc.vault.listEntries.query()
			setEntries(result)
		} catch (err) {
			console.error("[VaultSection] failed to load entries", err)
		}
	}, [])

	useEffect(() => {
		loadEntries()
	}, [loadEntries])

	// Load system prompt once
	useEffect(() => {
		trpc.vault.getSystemPrompt
			.query()
			.then(({ value: v }) => {
				setSystemPromptText(v ?? DEFAULT_VAULT_SYSTEM_PROMPT)
				setSystemPromptLoaded(true)
			})
			.catch(() => {
				setSystemPromptText(DEFAULT_VAULT_SYSTEM_PROMPT)
				setSystemPromptLoaded(true)
			})
	}, [])

	// Auto-save system prompt with debounce
	const handleSystemPromptChange = (text: string) => {
		setSystemPromptText(text)
		if (systemPromptTimerRef.current) clearTimeout(systemPromptTimerRef.current)
		systemPromptTimerRef.current = setTimeout(async () => {
			setSystemPromptSaving(true)
			try {
				await trpc.vault.setSystemPrompt.mutate({ text })
			} finally {
				setSystemPromptSaving(false)
			}
		}, 800)
	}

	const handleRestoreDefault = () => handleSystemPromptChange(DEFAULT_VAULT_SYSTEM_PROMPT)

	const handleCreate = async () => {
		if (!label.trim() || !value.trim()) return
		setSaving(true)
		try {
			await trpc.vault.createEntry.mutate({ label: label.trim(), type, value })
			setLabel("")
			setValue("")
			setType("password")
			setShowAddForm(false)
			await loadEntries()
		} catch (err) {
			console.error("[VaultSection] failed to create entry", err)
		} finally {
			setSaving(false)
		}
	}

	const handleDelete = async (id: string) => {
		try {
			await trpc.vault.deleteEntry.mutate(id)
			await loadEntries()
		} catch (err) {
			console.error("[VaultSection] failed to delete entry", err)
		}
	}

	const handleCopyToken = (id: string) => {
		navigator.clipboard.writeText(`[VAULT:${id}]`)
		setCopiedId(id)
		setTimeout(() => setCopiedId(null), 2000)
	}

	return (
		<div>
			{renderSectionHeader("vault")}
			<Section>
				<div className="flex flex-col gap-4">
					<p className="text-xs text-vscode-descriptionForeground">
						Store sensitive values (passwords, tokens, card numbers) securely. The AI only sees{" "}
						<code className="bg-vscode-editor-background px-1 rounded text-[10px]">[VAULT:id]</code> placeholders —
						actual values are resolved in the extension host before tool execution and are never sent to the model.
					</p>

					{/* Security system prompt */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<div>
								<Label className="text-sm font-medium">Security Instructions for the AI</Label>
								<p className="text-xs text-vscode-descriptionForeground mt-0.5">
									This text is injected into the system prompt so the model knows how to handle sensitive data
									and vault tokens. Edit to suit your workflow.
								</p>
							</div>
							{systemPromptSaving && (
								<span className="text-xs text-vscode-descriptionForeground shrink-0 ml-2">Saving…</span>
							)}
						</div>
						<textarea
							className="w-full min-h-[160px] px-2 py-1.5 text-xs rounded bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground outline-none focus:border-vscode-focusBorder resize-y font-mono leading-relaxed"
							disabled={!systemPromptLoaded}
							onChange={(e) => handleSystemPromptChange(e.target.value)}
							value={systemPromptLoaded ? systemPromptText : "Loading…"}
						/>
						<button
							className="self-start text-xs text-vscode-descriptionForeground hover:text-vscode-foreground underline underline-offset-2"
							onClick={handleRestoreDefault}
							type="button">
							Restore default
						</button>
					</div>

					{/* Entry list */}
					{entries.length > 0 && (
						<div className="flex flex-col gap-2">
							{entries.map((entry) => (
								<div
									className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-vscode-editor-background border border-vscode-input-border"
									key={entry.id}>
									<div className="flex items-center gap-2 min-w-0">
										<span className="text-xs px-1.5 py-0.5 rounded bg-vscode-badge-background text-vscode-badge-foreground shrink-0">
											{VAULT_TYPE_LABELS[entry.type]}
										</span>
										<span className="text-sm truncate">{entry.label}</span>
									</div>
									<div className="flex items-center gap-1 shrink-0">
										<Button
											className="h-6 px-2 text-xs gap-1"
											onClick={() => handleCopyToken(entry.id)}
											size="sm"
											title="Copy [VAULT:id] token to clipboard"
											variant="ghost">
											<CopyIcon className="w-3 h-3" />
											{copiedId === entry.id ? "Copied!" : "Copy token"}
										</Button>
										<Button
											className="h-6 w-6 p-0 text-vscode-errorForeground hover:text-vscode-errorForeground"
											onClick={() => handleDelete(entry.id)}
											size="sm"
											title="Delete entry"
											variant="ghost">
											<TrashIcon className="w-3.5 h-3.5" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}

					{entries.length === 0 && !showAddForm && (
						<p className="text-xs text-vscode-descriptionForeground italic">No vault entries yet.</p>
					)}

					{/* Add form */}
					{showAddForm ? (
						<div className="flex flex-col gap-3 p-3 rounded border border-vscode-input-border bg-vscode-editor-background">
							<div className="flex flex-col gap-1">
								<Label className="text-xs">Label</Label>
								<input
									className="w-full px-2 py-1 text-sm rounded bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground outline-none focus:border-vscode-focusBorder"
									onChange={(e) => setLabel(e.target.value)}
									placeholder="e.g. GitHub Token"
									type="text"
									value={label}
								/>
							</div>
							<div className="flex flex-col gap-1">
								<Label className="text-xs">Type</Label>
								<Select onValueChange={(v) => setType(v as VaultEntryType)} value={type}>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(Object.keys(VAULT_TYPE_LABELS) as VaultEntryType[]).map((t) => (
											<SelectItem key={t} value={t}>
												{VAULT_TYPE_LABELS[t]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1">
								<Label className="text-xs">Value</Label>
								<input
									autoComplete="new-password"
									className="w-full px-2 py-1 text-sm rounded bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground outline-none focus:border-vscode-focusBorder"
									onChange={(e) => setValue(e.target.value)}
									placeholder="Secret value"
									type="password"
									value={value}
								/>
							</div>
							<div className="flex gap-2 justify-end">
								<Button
									onClick={() => {
										setShowAddForm(false)
										setLabel("")
										setValue("")
										setType("password")
									}}
									size="sm"
									variant="ghost">
									Cancel
								</Button>
								<Button disabled={saving || !label.trim() || !value.trim()} onClick={handleCreate} size="sm">
									{saving ? "Saving…" : "Add Entry"}
								</Button>
							</div>
						</div>
					) : (
						<Button className="self-start gap-1.5" onClick={() => setShowAddForm(true)} size="sm" variant="outline">
							<PlusIcon className="w-3.5 h-3.5" />
							Add Entry
						</Button>
					)}
				</div>
			</Section>
		</div>
	)
}

export default VaultSection
