# Pocket Chess

A browser chessboard for two people sharing a device or one person playing against the computer. Open **Game options** to enter player names, select a difficulty, or reset the board by starting a new game. **Swap White and Black** keeps the names and switches sides for the next game. Select a piece to see its legal destinations, then select a destination to move. On a keyboard, use the arrow keys to navigate the board and Enter or Space to select a square.

Choose Classic, Porcelain, or Walnut in **Game options**. The choice applies immediately and keeps the current game.

The board rotates to put the active local player at the bottom. Against the computer it faces the human player. Use **Flip board** beside the clocks to rotate it manually until the next move. The clocks show elapsed time and pause while the page is hidden, Game options is open, or a check alert is awaiting acknowledgment. The game saves its moves, clocks, player settings, and board orientation in the current browser. Undo steps back one move in a person-versus-person game. In computer mode it returns to your previous turn. Stockfish 18 Lite runs in a browser worker with seven levels from Beginner to Maximum. See [Stockfish source and license information](public/stockfish/README.txt). Moves glide across the board unless the browser has reduced motion enabled.

## Development

Use Node.js 22.12+ or 24 LTS.

```sh
npm ci
npm run dev
```

Run `npm run build` for the production bundle and `npm run preview` to serve that bundle locally.
