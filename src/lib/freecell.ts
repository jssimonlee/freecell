export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
export const FOUNDATION_SLOTS = [...SUITS]

const RANK_LABELS = ['?', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export type Suit = (typeof SUITS)[number]
type Color = 'red' | 'black'

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

export interface Card {
  id: string
  rank: number
  rankText: string
  suit: Suit
  suitSymbol: string
  color: Color
}

type Foundations = Record<Suit, Card[]>

export interface GameState {
  cascades: Card[][]
  freeCells: Array<Card | null>
  foundations: Foundations
  moves: number
}

export interface CascadeSelection {
  kind: 'cascade'
  column: number
  startIndex: number
  cards: Card[]
}

export interface FreeCellSelection {
  kind: 'freeCell'
  index: number
  cards: [Card]
}

export type Selection = CascadeSelection | FreeCellSelection

function createEmptyFoundations(): Foundations {
  return {
    clubs: [],
    diamonds: [],
    hearts: [],
    spades: [],
  }
}

function createDeck(): Card[] {
  return SUITS.flatMap((suit) => {
    const color: Color = suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black'

    return Array.from({ length: 13 }, (_, offset) => {
      const rank = offset + 1

      return {
        id: `${suit}-${rank}`,
        rank,
        rankText: RANK_LABELS[rank],
        suit,
        suitSymbol: SUIT_SYMBOLS[suit],
        color,
      }
    })
  })
}

function shuffleDeck(cards: Card[]) {
  const nextDeck = [...cards]

  for (let index = nextDeck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[nextDeck[index], nextDeck[swapIndex]] = [nextDeck[swapIndex], nextDeck[index]]
  }

  return nextDeck
}

function isDescendingAlternating(cards: Card[]) {
  for (let index = 0; index < cards.length - 1; index += 1) {
    const current = cards[index]
    const next = cards[index + 1]

    if (current.color === next.color || current.rank !== next.rank + 1) {
      return false
    }
  }

  return true
}

function canPlaceOnCascade(movingCard: Card, targetCard?: Card) {
  if (!targetCard) {
    return true
  }

  return movingCard.color !== targetCard.color && movingCard.rank + 1 === targetCard.rank
}

function canMoveCardToFoundation(card: Card, foundations: Foundations) {
  const pile = foundations[card.suit]

  if (pile.length === 0) {
    return card.rank === 1
  }

  return pile[pile.length - 1].rank + 1 === card.rank
}

function removeSelection(nextGame: GameState, selection: Selection) {
  if (selection.kind === 'cascade') {
    nextGame.cascades[selection.column] = nextGame.cascades[selection.column].slice(
      0,
      selection.startIndex,
    )
    return
  }

  nextGame.freeCells[selection.index] = null
}

function getEmptyCascadeCount(game: GameState, ignoredColumns: number[]) {
  return game.cascades.reduce((count, cascade, index) => {
    if (ignoredColumns.includes(index)) {
      return count
    }

    return cascade.length === 0 ? count + 1 : count
  }, 0)
}

function getMaxMovableCards(game: GameState, selection: Selection, targetColumn: number) {
  const ignoredColumns = [targetColumn]

  if (selection.kind === 'cascade') {
    ignoredColumns.push(selection.column)
  }

  const emptyCascades = getEmptyCascadeCount(game, ignoredColumns)

  return (countEmptyFreeCells(game) + 1) * 2 ** emptyCascades
}

export function createGame(): GameState {
  const cascades = Array.from({ length: 8 }, () => [] as Card[])

  shuffleDeck(createDeck()).forEach((card, index) => {
    cascades[index % cascades.length].push(card)
  })

  return {
    cascades,
    freeCells: [null, null, null, null],
    foundations: createEmptyFoundations(),
    moves: 0,
  }
}

export function cloneGame(game: GameState): GameState {
  const foundations = SUITS.reduce<Foundations>((nextFoundations, suit) => {
    nextFoundations[suit] = [...game.foundations[suit]]
    return nextFoundations
  }, createEmptyFoundations())

  return {
    cascades: game.cascades.map((cascade) => [...cascade]),
    freeCells: [...game.freeCells],
    foundations,
    moves: game.moves,
  }
}

export function buildCascadeSelection(
  game: GameState,
  column: number,
  startIndex: number,
): CascadeSelection | null {
  const cascade = game.cascades[column]
  const cards = cascade.slice(startIndex)

  if (cards.length === 0 || !isDescendingAlternating(cards)) {
    return null
  }

  return {
    kind: 'cascade',
    column,
    startIndex,
    cards,
  }
}

export function buildFreeCellSelection(game: GameState, index: number): FreeCellSelection | null {
  const card = game.freeCells[index]

  if (!card) {
    return null
  }

  return {
    kind: 'freeCell',
    index,
    cards: [card],
  }
}

export function canMoveSelectionToFoundation(
  game: GameState,
  selection: Selection,
  targetSuit?: Suit,
) {
  if (selection.cards.length !== 1) {
    return false
  }

  const [card] = selection.cards

  if (targetSuit && targetSuit !== card.suit) {
    return false
  }

  return canMoveCardToFoundation(card, game.foundations)
}

export function canMoveSelectionToFreeCell(
  game: GameState,
  selection: Selection,
  targetIndex: number,
) {
  if (selection.cards.length !== 1) {
    return false
  }

  if (selection.kind === 'freeCell' && selection.index === targetIndex) {
    return false
  }

  return game.freeCells[targetIndex] === null
}

export function canMoveSelectionToCascade(
  game: GameState,
  selection: Selection,
  targetColumn: number,
) {
  if (selection.kind === 'cascade' && selection.column === targetColumn) {
    return false
  }

  if (!isDescendingAlternating(selection.cards)) {
    return false
  }

  if (selection.cards.length > getMaxMovableCards(game, selection, targetColumn)) {
    return false
  }

  const targetCascade = game.cascades[targetColumn]
  const targetCard = targetCascade[targetCascade.length - 1]

  return canPlaceOnCascade(selection.cards[0], targetCard)
}

export function moveSelectionToFoundation(
  game: GameState,
  selection: Selection,
  targetSuit?: Suit,
): GameState | null {
  if (!canMoveSelectionToFoundation(game, selection, targetSuit)) {
    return null
  }

  const nextGame = cloneGame(game)
  const [card] = selection.cards

  removeSelection(nextGame, selection)
  nextGame.foundations[card.suit] = [...nextGame.foundations[card.suit], card]
  nextGame.moves += 1

  return nextGame
}

export function moveSelectionToFreeCell(
  game: GameState,
  selection: Selection,
  targetIndex: number,
): GameState | null {
  if (!canMoveSelectionToFreeCell(game, selection, targetIndex)) {
    return null
  }

  const nextGame = cloneGame(game)
  const [card] = selection.cards

  removeSelection(nextGame, selection)
  nextGame.freeCells[targetIndex] = card
  nextGame.moves += 1

  return nextGame
}

export function moveSelectionToCascade(
  game: GameState,
  selection: Selection,
  targetColumn: number,
): GameState | null {
  if (!canMoveSelectionToCascade(game, selection, targetColumn)) {
    return null
  }

  const nextGame = cloneGame(game)

  removeSelection(nextGame, selection)
  nextGame.cascades[targetColumn] = [...nextGame.cascades[targetColumn], ...selection.cards]
  nextGame.moves += 1

  return nextGame
}

export function countEmptyFreeCells(game: GameState) {
  return game.freeCells.filter((card) => card === null).length
}

export function countEmptyCascades(game: GameState) {
  return game.cascades.filter((cascade) => cascade.length === 0).length
}

export function countSolvedCards(game: GameState) {
  return SUITS.reduce((count, suit) => count + game.foundations[suit].length, 0)
}

export function getOpenTransferCapacity(game: GameState) {
  return (countEmptyFreeCells(game) + 1) * 2 ** countEmptyCascades(game)
}

export function findFirstFoundationMove(game: GameState): Selection | null {
  for (let index = 0; index < game.freeCells.length; index += 1) {
    const selection = buildFreeCellSelection(game, index)

    if (selection && canMoveSelectionToFoundation(game, selection)) {
      return selection
    }
  }

  for (let column = 0; column < game.cascades.length; column += 1) {
    const cascade = game.cascades[column]
    const topIndex = cascade.length - 1

    if (topIndex < 0) {
      continue
    }

    const selection = buildCascadeSelection(game, column, topIndex)

    if (selection && canMoveSelectionToFoundation(game, selection)) {
      return selection
    }
  }

  return null
}

export function isGameWon(game: GameState) {
  return countSolvedCards(game) === 52
}