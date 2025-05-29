/// <reference types="node" />

import { defineConfig, Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import type { OutputAsset, OutputChunk } from "rollup"

// Custom plugin to inline CSS
const inlineCSS = (): Plugin => {
  return {
    name: "vite-plugin-inline-css",
    apply: "build" as const,
    enforce: "post" as const,
    generateBundle(_, bundle) {
      // Find CSS files
      const cssFiles = Object.keys(bundle).filter(key => key.endsWith(".css"))
      if (!cssFiles.length) return

      // Combine CSS content
      let cssContent = ""
      cssFiles.forEach(fileName => {
        const file = bundle[fileName] as OutputAsset
        if (file.type === "asset" && typeof file.source === "string") {
          cssContent += file.source
          // Remove the CSS files from the bundle
          delete bundle[fileName]
        }
      })

      // Inject CSS into each JS file
      Object.keys(bundle).forEach(fileName => {
        if (fileName.endsWith(".js")) {
          const jsFile = bundle[fileName] as OutputChunk
          if (jsFile.type === "chunk") {
            // Check if the file already has "use client" directive
            const hasUseClient = jsFile.code.includes('"use client";')
            
            // Inject CSS as a style tag into the JS, but preserve "use client" at the top
            const injectCode = `
(function() {
  if (typeof document !== 'undefined') {
    var style = document.createElement('style');
    style.setAttribute('data-tunio-player-styles', '');
    style.textContent = ${JSON.stringify(cssContent)};
    document.head.appendChild(style);
  }
})();`

            // If the file has "use client", remove it from the original code and add it at the top
            if (hasUseClient) {
              jsFile.code = jsFile.code.replace('"use client";', '')
              jsFile.code = '"use client";' + injectCode + jsFile.code
            } else {
              jsFile.code = injectCode + jsFile.code
            }
          }
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), inlineCSS()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "TunioPlayer",
      fileName: "audio-player",
      formats: ["es", "umd"]
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      output: [
        {
          format: "es",
          entryFileNames: "audio-player.js",
          banner: '"use client";'
        },
        {
          format: "umd",
          entryFileNames: "audio-player.umd.js",
          name: "TunioPlayer",
          globals: {
            "react": "React",
            "react-dom": "ReactDOM"
          }
        }
      ]
    },
    cssCodeSplit: false // Ensure all CSS is in a single file
  },
  server: {
    port: 3000
  }
})
