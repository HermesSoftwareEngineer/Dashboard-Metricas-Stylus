/**
 * imoviewService.ts
 * Mocked Imoview property/lead data.
 * Replace mock functions with real Imoview API calls when configured.
 */

export interface ImoviewProperty {
    id: string
    title: string
    type: 'sale' | 'rental'
    status: 'available' | 'negotiating' | 'sold' | 'rented'
    value: number
    area: number
}

export interface ImoviewStats {
    totalProperties: number
    available: number
    negotiating: number
    sold: number
    rented: number
    totalLeads: number
    newLeadsThisMonth: number
}

const MOCK_DELAY = 700

function delay<T>(value: T, ms = MOCK_DELAY): Promise<T> {
    return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

export const imoviewService = {
    getStats: (): Promise<ImoviewStats> =>
        delay({
            totalProperties: 128,
            available: 74,
            negotiating: 12,
            sold: 30,
            rented: 12,
            totalLeads: 358,
            newLeadsThisMonth: 47,
        }),

    getProperties: (): Promise<ImoviewProperty[]> =>
        delay([
            { id: 'p1', title: 'Apto Jardins', type: 'sale', status: 'available', value: 650000, area: 85 },
            { id: 'p2', title: 'Casa Vila Madalena', type: 'rental', status: 'rented', value: 4200, area: 120 },
            { id: 'p3', title: 'Studio Centro', type: 'sale', status: 'negotiating', value: 320000, area: 38 },
        ]),
}
