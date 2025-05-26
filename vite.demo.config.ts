/// <reference types="node" />

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  root: "demo",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "tunio-player": resolve(__dirname, "./src/index.ts")
    }
  }
}) 