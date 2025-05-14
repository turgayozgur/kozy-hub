import { Navbar } from "./components/navbar"
import { DeviceHub } from "./components/DeviceHub"

function App() {
  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Navbar />
      <main className="flex-1 overflow-hidden">
        <DeviceHub />
      </main>
    </div>
  )
}

export default App
