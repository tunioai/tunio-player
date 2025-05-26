# Tunio Player

React component for playing Tunio audio content.

## Installation

```bash
npm install tunio-player
# or
yarn add tunio-player
# or
pnpm add tunio-player
```

## Usage

```jsx
import { TunioPlayer } from 'tunio-player';

const App = () => {
  return (
    <div>
      <h1>My Player</h1>
      <TunioPlayer name="main" ambient={true} />
    </div>
  );
}
```

## API

### Props

| Property | Type     | Default   | Description                 |
|----------|----------|-----------|----------------------------|
| name     | string   | undefined | Radio stream name          |
| ambient  | boolean  | false     | Enable background effect   |

## Local Development

```bash
# Install dependencies
npm install

# Run demo in development mode
npm run dev

# Build package
npm run build
```

## License

MIT
