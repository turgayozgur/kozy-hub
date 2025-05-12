import { Sun, Moon } from 'lucide-react';
import { useTheme } from "./theme-provider"
import { cn } from "../lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className={cn(
        "rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
        "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        "relative",
        className
      )}
      aria-label="Toggle theme"
    >
      <span className="relative h-5 w-5 flex items-center justify-center">
        <Sun 
          className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 absolute" 
        />
        <Moon 
          className="h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 absolute" 
        />
      </span>
      <span className="sr-only">Toggle theme</span>
    </button>
  )
} 