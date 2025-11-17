import React from "react"
import { StrictMode } from "react"
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
        <Player name="station101-rock" ambient opacity={0}  />
      </div>

      {/* <div className="player-wrapper-light">
        <h2>Player with Ambient Mode on light background</h2>
        <Player name="station101-hiphop" theme="light" ambient />
      </div>

      <div className="player-wrapper-color">
        <h2>Player with Ambient Mode on light background</h2>
        <Player name="apocalypse" theme="dark" opacity={0} ambient />
      </div> */}
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
