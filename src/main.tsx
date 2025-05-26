import React from "react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import Player from "./Player"
import "./demo.css"

const App: React.FC = () => {
  return (
    <div className="demo-container">
      <h1>Tunio Player Demo</h1>
      <div className="player-wrapper">
        <h2>Player with Ambient Mode</h2>
        <Player name="ambient" ambient={true} />
      </div>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
