import { useThemeContext } from '@/contexts/ThemeContext'
import type { ThemeContextValue } from '@/types/theme.types'

/**
 * useTheme – thin wrapper for ThemeContext.
 * Provides { theme, toggleTheme, isDark }.
 */
export function useTheme(): ThemeContextValue {
    return useThemeContext()
}
