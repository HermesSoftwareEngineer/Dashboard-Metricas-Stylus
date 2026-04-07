import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import ImportPage from '@/pages/import'
import { LocacaoPage } from '@/pages/locacao/LocacaoPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <MainLayout>
                <DashboardPage />
              </MainLayout>
            }
          />
          <Route
            path="/import"
            element={
              <MainLayout>
                <ImportPage />
              </MainLayout>
            }
          />
          <Route
            path="/locacao"
            element={
              <MainLayout>
                <LocacaoPage />
              </MainLayout>
            }
          />
          {/* Redirect unknown routes to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
