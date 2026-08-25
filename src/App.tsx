import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { RequireAdmin, RequireEmployee } from './auth/RouteGuards'
import { useAuth } from './auth/useAuth'
import { authCallbackRoute, hasOAuthResponse } from './lib/auth-flow'

const ContainerHomesPage = lazy(() => import('./pages/ContainerHomesPage'))
const ClientComingSoonPage = lazy(() => import('./pages/ClientComingSoonPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const EmployeePortalLayout = lazy(() => import('./layouts/EmployeePortalLayout'))
const DashboardPage = lazy(() => import('./pages/portal/DashboardPage'))
const ResourceListPage = lazy(() => import('./pages/portal/ResourceListPage'))
const ResourceDetailPage = lazy(() => import('./pages/portal/ResourceDetailPage'))
const LeadCreatePage = lazy(() => import('./pages/portal/LeadCreatePage'))
const InventoryPage = lazy(() => import('./pages/portal/InventoryPage'))
const NewSalePage = lazy(() => import('./pages/portal/NewSalePage'))
const MarketingPage = lazy(() => import('./pages/portal/MarketingPage'))
const DocumentsPage = lazy(() => import('./pages/portal/DocumentsPage'))
const EmployeesAdminPage = lazy(() => import('./pages/portal/EmployeesAdminPage'))
const MarketingAdminPage = lazy(() => import('./pages/portal/MarketingAdminPage'))

function PublicHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { employee, session, loading, previewMode } = useAuth()

  // Supabase falls back to the configured Site URL when an environment-specific
  // callback is not allow-listed. Preserve that OAuth response and finish it on
  // the dedicated callback route instead of showing the public site.
  if (hasOAuthResponse(location.search)) {
    return <Navigate to={authCallbackRoute(location.search)} replace />
  }

  if (!loading && employee && (session || previewMode)) {
    return <Navigate to="/employee-portal" replace />
  }

  return <ContainerHomesPage onRouteNavigate={(path) => navigate(path)} />
}

function ClientPortal() {
  const navigate = useNavigate()
  return <ClientComingSoonPage onNavigate={(path) => navigate(path)} />
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  return null
}

export default function App() {
  return (
    <Suspense fallback={<main className="route-guard-state" aria-live="polite"><span>CMAC / LOADING</span><h1>Opening workspace</h1></main>}><ScrollToTop /><Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/client-portal" element={<ClientPortal />} />
      <Route element={<RequireEmployee />}>
        <Route path="/employee-portal" element={<EmployeePortalLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="leads" element={<ResourceListPage resource="leads" />} />
          <Route path="leads/new" element={<LeadCreatePage />} />
          <Route path="leads/:leadId" element={<ResourceDetailPage resource="leads" />} />
          <Route path="customers" element={<ResourceListPage resource="customers" />} />
          <Route path="customers/:contactId" element={<ResourceDetailPage resource="customers" />} />
          <Route path="tasks" element={<ResourceListPage resource="tasks" />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="sales/new" element={<NewSalePage />} />
          <Route path="deals" element={<ResourceListPage resource="deals" />} />
          <Route path="deals/:dealId" element={<ResourceDetailPage resource="deals" />} />
          <Route path="quotes" element={<ResourceListPage resource="quotes" />} />
          <Route path="contracts" element={<ResourceListPage resource="contracts" />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="admin/employees" element={<EmployeesAdminPage />} />
            <Route path="admin/marketing" element={<MarketingAdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  )
}
