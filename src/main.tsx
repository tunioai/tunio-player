import React from "react"
import { createRoot } from "react-dom/client"
import Player from "./Player"
import "./demo.css"
import "./global.scss"

const App: React.FC = () => {
  return (
    <div className="demo-container">
      <h1>Tunio Player Demo</h1>
      <div className="player-wrapper-dark">
        <h2>Player with Ambient Mode</h2>
        <Player id="bb6a70c0-7f61-47c9-830a-fab3b5060b50" ambient />
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
