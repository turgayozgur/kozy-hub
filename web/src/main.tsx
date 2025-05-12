import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import DeviceTest from './DeviceTest.tsx'
import { SignalRProvider } from './lib/SignalRContext'
import { ThemeProvider } from './components/theme-provider'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />
  },
  {
    path: '/device-test',
    element: <DeviceTest />
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <SignalRProvider>
        <RouterProvider router={router} />
      </SignalRProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
