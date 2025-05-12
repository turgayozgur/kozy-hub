import { ThemeToggle } from "./theme-toggle"
import { ConnectionStatus } from "./ConnectionStatus"
import { AddDeviceDialog } from "./AddDeviceDialog"

export function Navbar() {
  return (
    <nav className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <div className="font-semibold">Kozy Connect</div>
        <div className="flex items-center gap-4">
          <AddDeviceDialog />
          <ConnectionStatus />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
} 