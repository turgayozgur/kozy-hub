import { Navbar } from "./components/navbar"
import { DeviceHub } from "./components/DeviceHub"

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-2 md:pt-4">
        <DeviceHub />
      </main>
    </div>
  )
}

export default App
