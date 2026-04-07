/**
 * useDashboard.ts
 * Mock dashboard hook — returns KPI sections with fake data.
 * Wire up real services here when APIs are available.
 */

import { useFetch } from './useFetch'
import type { DashboardData } from '@/types/dashboard.types'

async function fetchDashboardData(): Promise<DashboardData> {
    // Simulate API latency
    await new Promise(r => setTimeout(r, 800))

    return {
        lastUpdated: new Date().toISOString(),
        sections: [
            {
                id: 'trello',
                title: 'Gestão de Tarefas (Trello)',
                cards: [
                    { id: 'tk-1', title: 'Cards em andamento', value: 0, unit: '', category: 'trello' },
                    { id: 'tk-2', title: 'Cards concluídos', value: 0, unit: '', category: 'trello' },
                    { id: 'tk-3', title: 'Cards vencidos', value: 0, unit: '', category: 'trello' },
                ],
            },
            {
                id: 'imoview',
                title: 'Imóveis (Imoview)',
                cards: [
                    { id: 'im-1', title: 'Total de imóveis', value: 0, unit: '', category: 'imoview' },
                    { id: 'im-2', title: 'Disponíveis', value: 0, unit: '', category: 'imoview' },
                    { id: 'im-3', title: 'Leads este mês', value: 0, unit: '', category: 'imoview' },
                ],
            },
            {
                id: 'spreadsheet',
                title: 'Financeiro (Planilhas)',
                cards: [
                    { id: 'sp-1', title: 'Receita do mês', value: 0, unit: 'R$', category: 'spreadsheet' },
                    { id: 'sp-2', title: 'Despesas do mês', value: 0, unit: 'R$', category: 'spreadsheet' },
                    { id: 'sp-3', title: 'Lucro do mês', value: 0, unit: 'R$', category: 'spreadsheet' },
                ],
            },
        ],
    }
}

export function useDashboard() {
    return useFetch<DashboardData>(fetchDashboardData)
}
