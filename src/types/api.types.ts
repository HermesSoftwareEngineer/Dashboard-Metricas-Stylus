export interface ApiResponse<T> {
    data: T
    success: boolean
    message?: string
    timestamp: string
}

export interface FetchState<T> {
    data: T | null
    loading: boolean
    error: string | null
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    page: number
    pageSize: number
    total: number
}
