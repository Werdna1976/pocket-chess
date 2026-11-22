# Pocket Chess

A browser chessboard for two players sharing a device. Select a piece to see its legal destinations, then select a destination to move. On a keyboard, use the arrow keys to navigate the board and Enter or Space to select a square.

The game saves its moves and board orientation in the current browser. Undo steps back one move at a time.

## Development

Use Node.js 22.12+ or 24 LTS.

```sh
npm ci
npm run dev
```

Run `npm run build` for the production bundle and `npm run preview` to serve that bundle locally.
