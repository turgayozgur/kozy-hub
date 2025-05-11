import { Button } from "./components/ui/button"
import { ThemeProvider } from "./components/theme-provider"
import { Navbar } from "./components/navbar"

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-12">
          <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
            <div className="flex max-w-[980px] flex-col items-start gap-2">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl lg:text-5xl lg:leading-[1.1]">
                Welcome to Kozy Connect <br className="hidden sm:inline" />
                A Static Site with Modern Tech
              </h1>
              <p className="max-w-[700px] text-lg text-muted-foreground sm:text-xl">
                Built with Vite, React, Tailwind CSS v3, and ShadCN UI. With dark mode support.
              </p>
            </div>
            <div className="flex gap-4">
              <Button size="lg">Get Started</Button>
              <Button size="lg" variant="outline">Documentation</Button>
            </div>
          </section>
        </main>
        <footer className="border-t py-6">
          <div className="container flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
            <p className="text-center text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Kozy Connect. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  )
}

export default App
