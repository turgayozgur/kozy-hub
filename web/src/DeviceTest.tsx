import { DeviceTestPanel } from "./components/DeviceTestPanel"
import { Navbar } from "./components/navbar"

export default function DeviceTest() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="max-w-md mx-auto mb-6 text-center">
            <h1 className="text-xl font-bold mb-2">Device Emulator</h1>
            <p className="text-sm text-muted-foreground">
              Connect as a device and interact with the main hub.
            </p>
          </div>
          <DeviceTestPanel />
        </div>
      </main>
    </div>
  )
} 