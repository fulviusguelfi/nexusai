import React, { createContext, useContext, useEffect, useState } from "react"
import { getStoragePrefix } from "../utils/detectWebviewType"

type LayoutOrientation = "horizontal" | "vertical"

interface LayoutContextType {
	orientation: LayoutOrientation
	setOrientation: (orientation: LayoutOrientation) => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

// Use per-context storage key to prevent sidebar and editor from sharing state
const LAYOUT_STORAGE_KEY = `${getStoragePrefix()}orientation`
// Default to vertical (sidebar layout) - horizontal is enabled via command when panel opens
const DEFAULT_ORIENTATION: LayoutOrientation = "vertical"

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [orientation, setOrientationState] = useState<LayoutOrientation>(DEFAULT_ORIENTATION)
	const [isLoaded, setIsLoaded] = useState(false)

	// Load from localStorage on mount
	useEffect(() => {
		try {
			const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
			if (stored === "horizontal" || stored === "vertical") {
				setOrientationState(stored)
			}
		} catch (error) {
			console.error("Failed to load layout preference from localStorage:", error)
		}
		console.log("[LayoutContext] Loaded from key:", LAYOUT_STORAGE_KEY, "orientation:", orientation)
		setIsLoaded(true)
	}, [])

	// Save to localStorage when orientation changes
	const setOrientation = (newOrientation: LayoutOrientation) => {
		console.log("[LayoutContext] Changing orientation to:", newOrientation, "key:", LAYOUT_STORAGE_KEY)
		setOrientationState(newOrientation)
		try {
			localStorage.setItem(LAYOUT_STORAGE_KEY, newOrientation)
		} catch (error) {
			console.error("Failed to save layout preference to localStorage:", error)
		}
	}

	return <LayoutContext.Provider value={{ orientation, setOrientation }}>{children}</LayoutContext.Provider>
}

export const useLayout = (): LayoutContextType => {
	const context = useContext(LayoutContext)
	if (!context) {
		throw new Error("useLayout must be used within a LayoutProvider")
	}
	return context
}
