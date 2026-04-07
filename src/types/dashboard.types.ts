export interface KPICard {
    id: string
    title: string
    value: string | number
    change?: number       // percentage change vs previous period
    changeLabel?: string
    unit?: string
    category: 'trello' | 'imoview' | 'spreadsheet' | 'general'
    icon?: string
}

export interface DashboardSection {
    id: string
    title: string
    cards: KPICard[]
}

export interface DashboardData {
    sections: DashboardSection[]
    lastUpdated: string
}

export interface DashboardFilters {
    dateRange?: {
        from: string
        to: string
    }
    category?: KPICard['category'] | 'all'
}
