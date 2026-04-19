import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import LandingPage from './LandingPage.jsx'
import OnboardingPage from './OnboardingPage.jsx'

const path = window.location.pathname

let Root
if (path.startsWith('/admin')) {
  Root = AdminApp
} else if (path.startsWith('/app')) {
  Root = App
} else if (path.startsWith('/onboarding')) {
  Root = OnboardingPage
} else {
  // '/' and '/signup' → landing page (handles auth + signup inline)
  Root = LandingPage
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
