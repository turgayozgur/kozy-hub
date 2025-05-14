import { ThemeToggle } from "./theme-toggle"
import { ConnectionStatus } from "./ConnectionStatus"
import { Link } from "react-router-dom"
import logoSvg from "../assets/images/logo.png"

export function Navbar() {
  return (
    <nav className="border-b">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="hover:opacity-80 transition-opacity flex items-center">
          <img src={logoSvg} alt="Kozy Connect" className="h-8" />
          <span className="sr-only">Kozy Connect</span>
        </Link>
        <div className="flex items-center gap-4">
          <ConnectionStatus />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
} 