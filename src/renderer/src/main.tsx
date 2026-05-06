import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { DisplayModeProvider } from './contexts/DisplayMode'
import { AppSettingsProvider } from './contexts/AppSettings'
import { LayoutModeProvider } from './contexts/LayoutMode'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

createRoot(container).render(
  <StrictMode>
    <AppSettingsProvider>
      <DisplayModeProvider>
        <LayoutModeProvider>
          <App />
        </LayoutModeProvider>
      </DisplayModeProvider>
    </AppSettingsProvider>
  </StrictMode>
)
