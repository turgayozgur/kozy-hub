import { ThemeProvider } from "./components/theme-provider"
import { Navbar } from "./components/navbar"
import { SignalRProvider } from "./lib/SignalRContext"
import { DeviceHub } from "./components/DeviceHub"

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <SignalRProvider>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1 container py-6">
            <DeviceHub />
          </main>
          <footer className="border-t py-4">
            <div className="container flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
              <p className="text-center text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Kozy Connect. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </SignalRProvider>
    </ThemeProvider>
  )
}

export default App
