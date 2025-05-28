# Tunio Player

Tunio Audio Player Component for React applications.

## Installation

```bash
npm install tunio-player
# or
yarn add tunio-player
# or
pnpm add tunio-player
```

## Usage

### Import the component and styles

```tsx
import { TunioPlayer } from 'tunio-player'
import 'tunio-player/dist/audio-player.css'

function App() {
  return (
    <div>
      <TunioPlayer 
        name="your-radio-name" 
        theme="dark" 
        ambient={true} 
      />
    </div>
  )
}
```

### Props

- `name` (string): Radio station name
- `theme` ("dark" | "light"): Player theme (default: "dark")
- `ambient` (boolean): Enable ambient background effect (default: false)
- `opacity` (number): Player opacity (default: 1)

## Features

- 🎵 Audio streaming with auto-reconnection
- 🎨 Dark and light themes
- ✨ Ambient background effects
- 📱 Responsive design
- 🔊 Volume control
- 🔇 Mute functionality
- ⏯️ Play/pause controls
- 📡 Real-time track information

## TypeScript Support

This package includes TypeScript definitions out of the box.

## Local Development

```bash
# Install dependencies
pnpm install

# Run demo in development mode
pnpm dev

# Build package
pnpm build
```

## License

MIT
