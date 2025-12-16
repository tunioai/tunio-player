import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import Player from "./Player"
import "./demo.css"
import "./global.scss"

const stations = [
  { key: "main", id: "a2f86e8e-5b10-434a-b8b7-e47b17535e6b" },
  { key: "rulounge", id: "72f0ecc3-4fb2-46fc-b9d8-94d1a8e923ad" },
  { key: "test station", id: "348d6514-8772-4cfb-94b3-6f24ec7a12e5" }
]

const App: React.FC = () => {
  const [selectedStation, setSelectedStation] = useState(stations[0])

  return (
    <div className="demo-container">
      <h1>Tunio Player Demo</h1>
      <div className="station-switcher">
        {stations.map(station => (
          <button
            key={station.key}
            type="button"
            className={station.key === selectedStation.key ? "active" : ""}
            onClick={() => setSelectedStation(station)}
          >
            {station.key}
          </button>
        ))}
      </div>
      <div className="player-wrapper-dark">
        <h2>Player with Ambient Mode</h2>
        <Player id={selectedStation.id} ambient />
      </div>

      {/* <div className="player-wrapper-light">
        <h2>Player with Ambient Mode on light background</h2>
        <Player id="7841b380-5d15-426a-9988-143d06d5c550" theme="light" ambient />
      </div> */}

      {/* <div className="player-wrapper-color">
        <h2>Player with Ambient Mode on light background</h2>
        <Player name="apocalypse" theme="dark" opacity={0} ambient />
      </div> */}
    </div>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
