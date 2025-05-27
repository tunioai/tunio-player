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
import Player from 'tunio-player';

const App = () => {
  return (
    <div>
      <h1>My Player</h1>
      <Player name="main" ambient={true} theme="dark" />
    </div>
  );
}
```

## API

### Props

| Property | Type              | Default   | Description                    |
|----------|-------------------|-----------|--------------------------------|
| name     | string            | required  | Radio stream name              |
| ambient  | boolean           | false     | Enable background effect       |
| theme    | "dark" \| "light" | "dark"    | Player theme                   |
| opacity  | number            | undefined | Background opacity (0.0 - 1.0) |

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
