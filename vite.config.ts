/// <reference types="node" />

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "TunioPlayer",
      fileName: "audio-player"
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      output: {
        globals: {
          "react": "React",
          "react-dom": "ReactDOM"
        },
        banner: '"use client";'
      }
    }
  },
  server: {
    port: 3000
  }
})
