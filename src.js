import { Chess } from 'chess.js'
import './style.css'

const game = new Chess()
const symbols = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
const pieceNames = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const colors = { w: 'White', b: 'Black' }
const board = document.querySelector('#board')
const status = document.querySelector('#status')
const historyPanel = document.querySelector('#moves')
const promotion = document.querySelector('#promotion')
const promotionOptions = document.querySelector('#promotion-options')
const optionsDialog = document.querySelector('#options')
const settingsForm = document.querySelector('#game-settings')
const fields = settingsForm.elements
const defaults = { opponent: 'person', white: '', black: '', difficulty: 'medium' }
const storageKey = 'pocket-chess-v1'
let selected = null
let flipped = false
let settings = { ...defaults }
let engine = null

try {
  const saved = JSON.parse(localStorage.getItem(storageKey))
  if (saved) {
    game.loadPgn(saved.pgn)
    flipped = saved.flipped === true
    const options = saved.settings
    if (options) {
      settings = {
        opponent: options.opponent === 'computer' ? 'computer' : 'person',
        white: typeof options.white === 'string' ? options.white.trim().slice(0, 40) : '',
        black: typeof options.black === 'string' ? options.black.trim().slice(0, 40) : '',
        difficulty: ['easy', 'medium', 'hard'].includes(options.difficulty) ? options.difficulty : defaults.difficulty,
      }
    }
  }
} catch {
  game.reset()
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ pgn: game.pgn(), flipped, settings }))
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

function pieceMarkup(type, color) {
  return `<span class="piece ${color}" aria-hidden="true">${symbols[type]}</span>`
}

function playerName(color) {
  return color === 'w' ? settings.white || colors.w
    : settings.black || (settings.opponent === 'computer' ? 'Computer' : colors.b)
}

function computerTurn() {
  return settings.opponent === 'computer' && game.turn() === 'b' && !game.isGameOver()
}

function gameStatus() {
  const turn = game.turn()
  if (game.isCheckmate()) return `${playerName(turn === 'w' ? 'b' : 'w')} wins · Checkmate`
  if (game.isStalemate()) return 'Draw · Stalemate'
  if (game.isInsufficientMaterial()) return 'Draw · Insufficient material'
  if (game.isThreefoldRepetition()) return 'Draw · Threefold repetition'
  if (game.isDrawByFiftyMoves()) return 'Draw · Fifty-move rule'
  if (computerTurn()) return `${playerName(turn)} is thinking…`
  return `${playerName(turn)} to move${game.isCheck() ? ' · Check' : ''}`
}

function render(focusSquare) {
  const history = game.history({ verbose: true })
  const last = history.at(-1)
  const targets = new Set(selected ? game.moves({ square: selected, verbose: true }).map(move => move.to) : [])
  const files = [...(flipped ? 'hgfedcba' : 'abcdefgh')]
  const ranks = [...(flipped ? '12345678' : '87654321')]
  board.innerHTML = ''

  ranks.forEach((rank, row) => files.forEach((file, column) => {
    const square = file + rank
    const piece = game.get(square)
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.square = square
    button.className = (row + column) % 2 ? 'square dark' : 'square light'
    button.classList.toggle('last', square === last?.from || square === last?.to)
    button.classList.toggle('selected', square === selected)
    button.classList.toggle('target', targets.has(square))
    button.classList.toggle('capture', targets.has(square) && Boolean(piece))
    button.classList.toggle('check', Boolean(piece?.type === 'k' && piece.color === game.turn() && game.isCheck()))
    button.setAttribute('aria-pressed', String(square === selected))
    const description = piece ? `${colors[piece.color]} ${pieceNames[piece.type]}` : 'empty'
    button.setAttribute('aria-label', `${square}, ${description}${targets.has(square) ? ', legal destination' : ''}`)
    button.tabIndex = square === (focusSquare || selected || files[0] + ranks[0]) ? 0 : -1
    if (column === 0) button.innerHTML += `<span class="rank" aria-hidden="true">${rank}</span>`
    if (row === 7) button.innerHTML += `<span class="file" aria-hidden="true">${file}</span>`
    if (piece) button.innerHTML += pieceMarkup(piece.type, piece.color)
    board.append(button)
  }))

  status.textContent = gameStatus()
  document.querySelector('#mode').textContent = settings.opponent === 'computer'
    ? `Computer · ${settings.difficulty}` : 'Local multiplayer'
  for (const [position, color] of [['top', flipped ? 'w' : 'b'], ['bottom', flipped ? 'b' : 'w']]) {
    const active = !game.isGameOver() && color === game.turn()
    const player = document.querySelector(`#${position}-player`)
    player.innerHTML = `<div class="player-icon">${pieceMarkup('k', color)}</div><strong></strong>${active ? '<span class="turn-dot" aria-label="Current turn"></span>' : ''}`
    player.querySelector('strong').textContent = playerName(color)
  }
  document.querySelector('#undo').disabled = history.length === 0

  if (history.length) {
    const rows = []
    for (let i = 0; i < history.length; i += 2) {
      rows.push(`<li><span>${history[i].san}</span><span>${history[i + 1]?.san ?? ''}</span></li>`)
    }
    historyPanel.innerHTML = `<ol>${rows.join('')}</ol>`
    historyPanel.scrollTop = historyPanel.scrollHeight
  } else {
    historyPanel.innerHTML = '<p>No moves yet.</p>'
  }
  if (focusSquare) board.querySelector(`[data-square="${focusSquare}"]`)?.focus({ preventScroll: true })
}

function stopEngine() {
  engine?.terminate()
  engine = null
}

function startComputerTurn() {
  if (!computerTurn() || engine || optionsDialog.open) return
  const worker = new Worker(new URL('./engine.js', import.meta.url), { type: 'module' })
  engine = worker
  worker.onmessage = ({ data: move }) => {
    if (engine !== worker) return
    stopEngine()
    if (move && computerTurn()) play(move, false)
  }
  worker.onerror = () => {
    if (engine !== worker) return
    stopEngine()
    status.textContent = 'Computer unavailable. Undo or start a new game.'
  }
  worker.postMessage({ pgn: game.pgn(), difficulty: settings.difficulty })
}

function play(move, focus = true) {
  game.move(move)
  selected = null
  save()
  render(focus ? move.to : board.contains(document.activeElement) ? document.activeElement.dataset.square : undefined)
  startComputerTurn()
}

board.addEventListener('click', event => {
  const square = event.target.closest('[data-square]')?.dataset.square
  if (!square || game.isGameOver() || computerTurn()) return
  const options = selected ? game.moves({ square: selected, verbose: true }).filter(move => move.to === square) : []
  if (options[0]?.promotion) {
    promotionOptions.replaceChildren()
    for (const move of options) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('aria-label', `Promote to ${pieceNames[move.promotion]}`)
      button.innerHTML = pieceMarkup(move.promotion, move.color)
      button.addEventListener('click', () => {
        promotion.close()
        play(move)
      })
      promotionOptions.append(button)
    }
    promotion.showModal()
    return
  }
  if (options.length) {
    play(options[0])
    return
  }
  selected = selected !== square && game.get(square)?.color === game.turn() ? square : null
  render(square)
})

board.addEventListener('keydown', event => {
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }
  if (!Object.hasOwn(offsets, event.key)) return
  const buttons = [...board.children]
  const index = buttons.indexOf(event.target)
  if (index < 0) return
  event.preventDefault()
  if ((event.key === 'ArrowLeft' && index % 8 === 0) || (event.key === 'ArrowRight' && index % 8 === 7)) return
  const next = buttons[index + offsets[event.key]]
  if (!next) return
  buttons.forEach(button => { button.tabIndex = button === next ? 0 : -1 })
  next.focus()
})

document.querySelector('#undo').addEventListener('click', () => {
  stopEngine()
  game.undo()
  if (settings.opponent === 'computer' && game.turn() === 'b') game.undo()
  selected = null
  save()
  render()
})

document.querySelector('#flip').addEventListener('click', () => {
  flipped = !flipped
  save()
  render()
})

function updateOptionsFields() {
  const computer = fields.opponent.value === 'computer'
  document.querySelector('#difficulty-field').hidden = !computer
  document.querySelector('#black-label').textContent = computer ? 'Computer name' : 'Black player name'
  fields.black.placeholder = computer ? 'Computer' : 'Black'
}

document.querySelector('#options-button').addEventListener('click', () => {
  for (const [name, value] of Object.entries(settings)) fields[name].value = value
  updateOptionsFields()
  stopEngine()
  optionsDialog.showModal()
})

fields.opponent.addEventListener('change', updateOptionsFields)
document.querySelector('#cancel-options').addEventListener('click', () => optionsDialog.close())
optionsDialog.addEventListener('close', startComputerTurn)
settingsForm.addEventListener('submit', event => {
  event.preventDefault()
  settings = {
    opponent: fields.opponent.value,
    white: fields.white.value.trim(),
    black: fields.black.value.trim(),
    difficulty: fields.difficulty.value,
  }
  game.reset()
  selected = null
  save()
  render()
  optionsDialog.close()
})

render()
startComputerTurn()
