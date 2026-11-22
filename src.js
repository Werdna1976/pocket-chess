import { Chess } from 'chess.js'
import './style.css'

const game = new Chess()
const pieceSets = { classic: 'Classic', porcelain: 'Porcelain', walnut: 'Walnut' }
const pieceNames = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const colors = { w: 'White', b: 'Black' }
const board = document.querySelector('#board')
const status = document.querySelector('#status')
const historyPanel = document.querySelector('#moves')
const promotion = document.querySelector('#promotion')
const promotionOptions = document.querySelector('#promotion-options')
const turnAlert = document.querySelector('#turn-alert')
const optionsDialog = document.querySelector('#options')
const settingsForm = document.querySelector('#game-settings')
const fields = settingsForm.elements
const defaults = { opponent: 'person', white: '', black: '', difficulty: 'medium', computerColor: 'b' }
const storageKey = 'pocket-chess-v1'
let pieceSet = 'classic'
let selected = null
let flipped = false
let settings = { ...defaults }
let engine = null
let clock = { w: 0, b: 0 }
let clockStarted = null
let acknowledgedCheck = ''

try {
  const saved = JSON.parse(localStorage.getItem(storageKey))
  if (saved) {
    game.loadPgn(saved.pgn)
    flipped = saved.flipped === true
    if (Object.hasOwn(pieceSets, saved.pieceSet)) pieceSet = saved.pieceSet
    for (const color of ['w', 'b']) {
      if (Number.isFinite(saved.clock?.[color]) && saved.clock[color] >= 0) clock[color] = saved.clock[color]
    }
    acknowledgedCheck = typeof saved.acknowledgedCheck === 'string' ? saved.acknowledgedCheck : ''
    const options = saved.settings
    if (options) {
      settings = {
        computerColor: options.computerColor === 'w' ? 'w' : 'b',
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
    const elapsed = { ...clock, [game.turn()]: elapsedTime(game.turn()) }
    localStorage.setItem(storageKey, JSON.stringify({
      pgn: game.pgn(), flipped, settings, pieceSet, clock: elapsed, acknowledgedCheck,
    }))
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

function pieceMarkup(type, color, set = pieceSet) {
  return `<img class="piece" src="${import.meta.env.BASE_URL}pieces/${set}/${color}${type}.png" alt="" draggable="false">`
}

const piecePicker = document.querySelector('#piece-sets')
for (const [id, name] of Object.entries(pieceSets)) {
  const choice = document.createElement('label')
  choice.innerHTML = `<input type="radio" name="piece-set" value="${id}">
    <span class="piece-card">
      <span class="piece-preview">${pieceMarkup('n', 'w', id)}${pieceMarkup('q', 'b', id)}</span>
      <span>${name}</span>
    </span>`
  const radio = choice.querySelector('input')
  radio.checked = id === pieceSet
  radio.addEventListener('change', () => {
    pieceSet = id
    save()
    render()
  })
  piecePicker.append(choice)
}

function otherSide(color) {
  return color === 'w' ? 'b' : 'w'
}

function isComputer(color) {
  return settings.opponent === 'computer' && settings.computerColor === color
}

function playerName(color) {
  const name = color === 'w' ? settings.white : settings.black
  return name || (isComputer(color) ? 'Computer' : colors[color])
}

function computerTurn() {
  return isComputer(game.turn()) && !game.isGameOver()
}

function orientForTurn() {
  const perspective = settings.opponent === 'computer' ? otherSide(settings.computerColor) : game.turn()
  flipped = perspective === 'b'
}

function elapsedTime(color) {
  return clock[color] + (clockStarted !== null && color === game.turn() ? performance.now() - clockStarted : 0)
}

function updateClocks() {
  for (const [side, color] of [['white', 'w'], ['black', 'b']]) {
    const timer = document.querySelector(`#${side}-player .clock`)
    const seconds = Math.floor(elapsedTime(color) / 1000)
    timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    timer.setAttribute('aria-label', `${colors[color]} elapsed time: ${timer.textContent}`)
    timer.classList.toggle('running', clockStarted !== null && color === game.turn())
  }
}

function pauseClock() {
  clock[game.turn()] = elapsedTime(game.turn())
  clockStarted = null
  updateClocks()
}

function resumeTurn() {
  if (optionsDialog.open || turnAlert.open || game.isGameOver()) return
  if (clockStarted === null && !document.hidden) clockStarted = performance.now()
  updateClocks()
  startComputerTurn()
}

function announceCheck() {
  if (!game.isCheck() || acknowledgedCheck === game.fen()) return
  const mate = game.isCheckmate()
  turnAlert.dataset.state = mate ? 'mate' : 'check'
  document.querySelector('#turn-alert-title').textContent = mate ? 'Checkmate!' : 'Check!'
  document.querySelector('#turn-alert-detail').textContent = mate
    ? `${playerName(otherSide(game.turn()))} wins.`
    : `${playerName(game.turn())}’s king is under attack.`
  turnAlert.showModal()
}

function gameStatus() {
  const turn = game.turn()
  if (game.isCheckmate()) return `${playerName(otherSide(turn))} wins · Checkmate`
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
  const warning = game.isCheckmate() ? 'mate' : game.isCheck() ? 'check' : ''
  const targets = new Set(selected ? game.moves({ square: selected, verbose: true }).map(move => move.to) : [])
  const files = [...(flipped ? 'hgfedcba' : 'abcdefgh')]
  const ranks = [...(flipped ? '12345678' : '87654321')]
  document.querySelector('#flip').setAttribute('aria-pressed', String(flipped))
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
    if (warning && piece?.type === 'k' && piece.color === game.turn()) button.classList.add(warning)
    button.setAttribute('aria-pressed', String(square === selected))
    const description = piece ? `${colors[piece.color]} ${pieceNames[piece.type]}` : 'empty'
    button.setAttribute('aria-label', `${square}, ${description}${targets.has(square) ? ', legal destination' : ''}`)
    button.tabIndex = square === (focusSquare || selected || files[0] + ranks[0]) ? 0 : -1
    if (column === 0) button.innerHTML += `<span class="rank" aria-hidden="true">${rank}</span>`
    if (row === 7) button.innerHTML += `<span class="file" aria-hidden="true">${file}</span>`
    if (piece) button.innerHTML += pieceMarkup(piece.type, piece.color)
    board.append(button)
  }))

  document.querySelector('#brand-piece').innerHTML = pieceMarkup('n', 'w')
  status.textContent = gameStatus()
  status.dataset.state = warning
  document.querySelector('#mode').textContent = settings.opponent === 'computer'
    ? `Computer · ${settings.difficulty}` : 'Local multiplayer'
  for (const [side, color] of [['white', 'w'], ['black', 'b']]) {
    const player = document.querySelector(`#${side}-player`)
    player.innerHTML = `<div class="player-icon">${pieceMarkup('k', color)}</div><strong></strong><span class="clock" role="timer"></span>`
    player.querySelector('strong').textContent = playerName(color)
  }
  updateClocks()
  document.querySelector('#undo').disabled = history.length === 0
    || (history.length === 1 && isComputer(history[0].color))

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
  if (!computerTurn() || engine) return
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
    pauseClock()
    status.textContent = 'Computer unavailable. Undo or start a new game.'
  }
  worker.postMessage({ pgn: game.pgn(), difficulty: settings.difficulty })
}

function play(move, focus = true) {
  pauseClock()
  game.move(move)
  acknowledgedCheck = ''
  orientForTurn()
  selected = null
  save()
  render(focus ? move.to : board.contains(document.activeElement) ? document.activeElement.dataset.square : undefined)
  announceCheck()
  resumeTurn()
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
  pauseClock()
  game.undo()
  if (isComputer(game.turn())) game.undo()
  acknowledgedCheck = ''
  orientForTurn()
  selected = null
  save()
  render()
  announceCheck()
  resumeTurn()
})

document.querySelector('#flip').addEventListener('click', () => {
  flipped = !flipped
  save()
  render()
})

let draftComputerColor = settings.computerColor

function updateOptionsFields() {
  const computer = fields.opponent.value === 'computer'
  document.querySelector('#difficulty-field').hidden = !computer
  for (const [side, color] of [['white', 'w'], ['black', 'b']]) {
    const computerSide = computer && draftComputerColor === color
    document.querySelector(`#${side}-label`).textContent = computerSide ? 'Computer name' : `${colors[color]} player name`
    fields[side].placeholder = computerSide ? 'Computer' : colors[color]
  }
}

document.querySelector('#options-button').addEventListener('click', () => {
  for (const name of ['opponent', 'white', 'black', 'difficulty']) fields[name].value = settings[name]
  draftComputerColor = settings.computerColor
  updateOptionsFields()
  stopEngine()
  pauseClock()
  save()
  optionsDialog.showModal()
})

document.querySelector('#swap').addEventListener('click', () => {
  const white = fields.white.value
  fields.white.value = fields.black.value
  fields.black.value = white
  if (fields.opponent.value === 'computer') draftComputerColor = otherSide(draftComputerColor)
  updateOptionsFields()
})

fields.opponent.addEventListener('change', updateOptionsFields)
document.querySelector('#cancel-options').addEventListener('click', () => optionsDialog.close())
optionsDialog.addEventListener('close', resumeTurn)
settingsForm.addEventListener('submit', event => {
  event.preventDefault()
  settings = {
    opponent: fields.opponent.value,
    white: fields.white.value.trim(),
    black: fields.black.value.trim(),
    difficulty: fields.difficulty.value,
    computerColor: draftComputerColor,
  }
  game.reset()
  clock = { w: 0, b: 0 }
  acknowledgedCheck = ''
  orientForTurn()
  selected = null
  save()
  render()
  optionsDialog.close()
})

turnAlert.addEventListener('cancel', event => event.preventDefault())
turnAlert.querySelector('form').addEventListener('submit', () => {
  acknowledgedCheck = game.fen()
  save()
})
turnAlert.addEventListener('close', resumeTurn)

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseClock()
    save()
  } else {
    resumeTurn()
  }
})

render()
announceCheck()
resumeTurn()
setInterval(updateClocks, 250)
