import { Chess } from 'chess.js'

const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const depths = { easy: 1, medium: 2, hard: 3 }

function evaluate(game) {
  let score = 0
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece) continue
      const file = piece.square.charCodeAt(0) - 97
      const row = Number(piece.square[1]) - 1
      const center = 7 - Math.abs(3.5 - file) - Math.abs(3.5 - row)
      const advance = piece.color === 'w' ? row : 7 - row
      const position = piece.type === 'p' ? advance * 8 + center * 3
        : piece.type === 'k' ? 0 : center * 6
      score += (piece.color === 'w' ? 1 : -1) * (values[piece.type] + position)
    }
  }
  return game.turn() === 'w' ? score : -score
}

function orderedMoves(game) {
  const priority = move => (move.captured ? 10 * values[move.captured] - values[move.piece] : 0)
    + (move.promotion ? values[move.promotion] : 0)
  return game.moves({ verbose: true }).sort((a, b) => priority(b) - priority(a))
}

function search(game, depth, alpha, beta) {
  const moves = orderedMoves(game)
  if (!moves.length) return game.isCheck() ? -100000 - depth : 0
  if (game.isDraw()) return 0
  if (!depth) return evaluate(game)

  for (const move of moves) {
    game.move(move)
    const score = -search(game, depth - 1, -beta, -alpha)
    game.undo()
    if (score >= beta) return beta
    alpha = Math.max(alpha, score)
  }
  return alpha
}

self.onmessage = ({ data: { pgn, difficulty } }) => {
  const game = new Chess()
  game.loadPgn(pgn)
  const depth = depths[difficulty]
  let bestMove = null
  let bestScore = -Infinity

  for (const move of orderedMoves(game)) {
    game.move(move)
    const score = -search(game, depth - 1, -Infinity, difficulty === 'easy' ? Infinity : -bestScore)
      + (difficulty === 'easy' ? Math.random() * 160 : 0)
    game.undo()
    if (score > bestScore) {
      bestMove = { from: move.from, to: move.to, promotion: move.promotion }
      bestScore = score
    }
  }
  self.postMessage(bestMove)
}
