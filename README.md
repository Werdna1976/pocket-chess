# Pocket Chess

A browser chessboard for two people sharing a device or one person playing White against the computer. Open **Game options** to enter player names, select a difficulty, or reset the board by starting a new game. Select a piece to see its legal destinations, then select a destination to move. On a keyboard, use the arrow keys to navigate the board and Enter or Space to select a square.

The game saves its moves, player settings, and board orientation in the current browser. Undo steps back one move in a person-versus-person game. In computer mode it returns to your previous turn. The built-in computer runs in a browser worker and searches one, two, or three half-moves on Easy, Medium, or Hard.

## Development

Use Node.js 22.12+ or 24 LTS.

```sh
npm ci
npm run dev
```

Run `npm run build` for the production bundle and `npm run preview` to serve that bundle locally.
