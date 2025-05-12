import { Navbar } from "./components/navbar"
import { DeviceHub } from "./components/DeviceHub"
import { Link } from "react-router-dom"

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <DeviceHub />
      </main>
      <footer className="border-t py-4">
        <div className="container flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Kozy Connect. All rights reserved.
          </p>
          <div>
            <Link 
              to="/device-test" 
              className="text-center text-xs text-muted-foreground hover:underline"
            >
              Device Test Panel
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
