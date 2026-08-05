import { useCallback, useEffect, useState } from 'react'
import ContainerHomesPage from './pages/ContainerHomesPage'
import ClientComingSoonPage from './pages/ClientComingSoonPage'
import EmployeePortalPage from './pages/EmployeePortalPage'
import LoginPage from './pages/LoginPage'

type AppRoute = 'home' | 'login' | 'employee' | 'client'

const routeByPath: Record<string, AppRoute> = {
  '/': 'home',
  '/login': 'login',
  '/employee-portal': 'employee',
  '/client-portal': 'client',
}

function routeForPath(pathname: string): AppRoute {
  return routeByPath[pathname.replace(/\/$/, '') || '/'] ?? 'home'
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeForPath(window.location.pathname))

  useEffect(() => {
    if (!routeByPath[window.location.pathname.replace(/\/$/, '') || '/']) {
      window.history.replaceState({}, '', '/')
    }

    const handlePopState = () => setRoute(routeForPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((path: string) => {
    const normalizedPath = path.replace(/\/$/, '') || '/'
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    window.history.pushState({}, '', normalizedPath)
    setRoute(routeForPath(normalizedPath))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  if (route === 'login') return <LoginPage onNavigate={navigate} />
  if (route === 'employee') return <EmployeePortalPage onNavigate={navigate} />
  if (route === 'client') return <ClientComingSoonPage onNavigate={navigate} />

  return <ContainerHomesPage onRouteNavigate={navigate} />
}
