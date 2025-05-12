import { ThemeToggle } from "./theme-toggle"
import { ConnectionStatus } from "./ConnectionStatus"
import { AddDeviceDialog } from "./AddDeviceDialog"
import { Link } from "react-router-dom"

export function Navbar() {
  return (
    <nav className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="font-semibold hover:text-primary transition-colors">Kozy Connect</Link>
        <div className="flex items-center gap-4">
          <AddDeviceDialog />
          <ConnectionStatus />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
} 