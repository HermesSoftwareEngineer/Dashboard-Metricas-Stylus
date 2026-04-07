// Typed design token constants — mirrors tailwind @theme values for use in TS logic

export const brandColors = {
    red: '#C61A26',
    redLight: '#E8323F',
    redDark: '#9C1520',
    orange: '#FF9F1C',
    orangeLight: '#FFB84D',
    orangeDark: '#CC7A00',
    green: '#4F734A',
    greenLight: '#6A9B63',
    greenDark: '#375234',
    dark: '#1E1E1E',
} as const

export const semanticColors = {
    success: '#4F734A',
    warning: '#FF9F1C',
    error: '#C61A26',
    info: '#3B82F6',
} as const

export const fontFamilies = {
    sans: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    display: "'Raleway', 'Poppins', ui-sans-serif, sans-serif",
} as const

export const typographyScale = {
    h1: 'text-3xl font-bold font-display',
    h2: 'text-2xl font-bold font-display',
    h3: 'text-xl font-semibold font-display',
    h4: 'text-base font-semibold font-display',
    body: 'text-sm font-sans',
    bodyLg: 'text-base font-sans',
    caption: 'text-xs font-sans text-[var(--color-text-muted)]',
    label: 'text-xs font-semibold uppercase tracking-wider font-sans',
} as const

export const spacing = {
    sidebar: '16rem',
    sidebarCollapsed: '4.5rem',
    headerHeight: '4rem',
} as const
