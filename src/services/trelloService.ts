/**
 * trelloService.ts
 * Mocked Trello board/card data.
 * Replace mock functions with real API calls when credentials are available.
 */

export interface TrelloCard {
    id: string
    name: string
    list: string
    dueDate: string | null
    labels: string[]
}

export interface TrelloBoard {
    id: string
    name: string
    cards: TrelloCard[]
    totalCards: number
    overdueCards: number
}

const MOCK_DELAY = 600

function delay<T>(value: T, ms = MOCK_DELAY): Promise<T> {
    return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

export const trelloService = {
    getBoard: (): Promise<TrelloBoard> =>
        delay({
            id: 'board-001',
            name: 'Stylus – Operações',
            totalCards: 42,
            overdueCards: 5,
            cards: [
                { id: 'c1', name: 'Reunião de planejamento', list: 'Em andamento', dueDate: '2026-04-05', labels: ['urgente'] },
                { id: 'c2', name: 'Revisão de contratos', list: 'Concluído', dueDate: null, labels: [] },
                { id: 'c3', name: 'Atualização de sistema', list: 'A fazer', dueDate: '2026-04-10', labels: ['técnico'] },
            ],
        }),

    getCardsByList: (listName: string): Promise<TrelloCard[]> =>
        delay(
            [
                { id: 'c1', name: 'Reunião de planejamento', list: listName, dueDate: '2026-04-05', labels: ['urgente'] },
            ]
        ),
}
