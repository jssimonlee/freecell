import { useEffect, useState, type MouseEvent } from 'react'
import {
  FOUNDATION_SLOTS,
  SUIT_SYMBOLS,
  buildCascadeSelection,
  buildFreeCellSelection,
  canMoveSelectionToCascade,
  canMoveSelectionToFoundation,
  canMoveSelectionToFreeCell,
  cloneGame,
  countEmptyCascades,
  countEmptyFreeCells,
  countSolvedCards,
  createGame,
  findFirstFoundationMove,
  getOpenTransferCapacity,
  isGameWon,
  moveSelectionToCascade,
  moveSelectionToFoundation,
  moveSelectionToFreeCell,
  type Card,
  type GameState,
  type Selection,
  type Suit,
} from './lib/freecell'
import './App.css'

const STACK_SPACING = 34

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function describeCard(card: Card) {
  return `${card.rankText}${card.suitSymbol}`
}

function describeSelection(selection: Selection) {
  if (selection.cards.length === 1) {
    return `${describeCard(selection.cards[0])} is ready to move. Choose a free cell, foundation, or cascade.`
  }

  return `${selection.cards.length}-card run starting with ${describeCard(selection.cards[0])} selected. Choose a destination cascade.`
}

function getMoveSummary(selection: Selection, destination: string) {
  if (selection.cards.length === 1) {
    return `${describeCard(selection.cards[0])} moved to ${destination}.`
  }

  return `${selection.cards.length}-card run moved to ${destination}.`
}

function cardIsSelected(selection: Selection | null, column: number, index: number) {
  return selection?.kind === 'cascade' && selection.column === column && index >= selection.startIndex
}

function freeCellIsSelected(selection: Selection | null, index: number) {
  return selection?.kind === 'freeCell' && selection.index === index
}

function CardFace({ card }: { card: Card }) {
  return (
    <>
      <span className="card-face__corner">
        <span>{card.rankText}</span>
        <span>{card.suitSymbol}</span>
      </span>
      <span className="card-face__pip">{card.suitSymbol}</span>
      <span className="card-face__corner card-face__corner--bottom">
        <span>{card.rankText}</span>
        <span>{card.suitSymbol}</span>
      </span>
    </>
  )
}

function App() {
  const [game, setGame] = useState<GameState>(() => createGame())
  const [history, setHistory] = useState<GameState[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [statusMessage, setStatusMessage] = useState(
    'Select an exposed card or an ordered run to start.',
  )

  const won = isGameWon(game)
  const emptyFreeCells = countEmptyFreeCells(game)
  const emptyCascades = countEmptyCascades(game)
  const solvedCards = countSolvedCards(game)
  const progress = Math.round((solvedCards / 52) * 100)
  const transferCapacity = getOpenTransferCapacity(game)

  useEffect(() => {
    setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))

    if (won) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [startedAt, won])

  const commitMove = (nextGame: GameState, message: string) => {
    const completed = isGameWon(nextGame)
    const currentElapsed = Math.floor((Date.now() - startedAt) / 1000)

    setHistory((previous) => [...previous, cloneGame(game)])
    setGame(nextGame)
    setSelection(null)
    setStatusMessage(
      completed
        ? `Table cleared in ${nextGame.moves} moves and ${formatTime(currentElapsed)}.`
        : message,
    )
  }

  const startNewDeal = () => {
    setGame(createGame())
    setHistory([])
    setSelection(null)
    setStartedAt(Date.now())
    setElapsedSeconds(0)
    setStatusMessage('Fresh deal. Free cells are empty and every card is exposed.')
  }

  const undoMove = () => {
    if (history.length === 0) {
      setStatusMessage('Nothing to undo yet.')
      return
    }

    const previousGame = history[history.length - 1]
    setHistory((previous) => previous.slice(0, -1))
    setGame(previousGame)
    setSelection(null)
    setStatusMessage('Last move undone.')
  }

  const select = (nextSelection: Selection) => {
    setSelection(nextSelection)
    setStatusMessage(describeSelection(nextSelection))
  }

  const moveSelectionToHome = (source: Selection, targetSuit?: Suit) => {
    const nextGame = moveSelectionToFoundation(game, source, targetSuit)

    if (!nextGame) {
      setStatusMessage(
        'Only a single exposed card can move home, and foundations build upward by matching suit.',
      )
      return
    }

    commitMove(nextGame, getMoveSummary(source, 'its foundation'))
  }

  const moveSelectionToColumn = (column: number) => {
    if (!selection) {
      setStatusMessage('Select a card or run before choosing a cascade.')
      return
    }

    const nextGame = moveSelectionToCascade(game, selection, column)

    if (!nextGame) {
      setStatusMessage(
        'That destination is blocked. Cascades build down in alternating colors and long runs depend on open cells.',
      )
      return
    }

    commitMove(nextGame, getMoveSummary(selection, `cascade ${column + 1}`))
  }

  const handleCascadeCardClick = (
    event: MouseEvent<HTMLButtonElement>,
    column: number,
    index: number,
  ) => {
    event.stopPropagation()

    if (
      selection?.kind === 'cascade' &&
      selection.column === column &&
      selection.startIndex === index
    ) {
      setSelection(null)
      setStatusMessage('Selection cleared.')
      return
    }

    if (selection) {
      const nextGame = moveSelectionToCascade(game, selection, column)

      if (nextGame) {
        commitMove(nextGame, getMoveSummary(selection, `cascade ${column + 1}`))
        return
      }
    }

    const nextSelection = buildCascadeSelection(game, column, index)

    if (!nextSelection) {
      setStatusMessage('You can only lift an alternating descending run from a cascade.')
      return
    }

    select(nextSelection)
  }

  const handleCascadeCardDoubleClick = (
    event: MouseEvent<HTMLButtonElement>,
    column: number,
    index: number,
  ) => {
    event.stopPropagation()

    if (index !== game.cascades[column].length - 1) {
      return
    }

    const source = buildCascadeSelection(game, column, index)

    if (source) {
      moveSelectionToHome(source)
    }
  }

  const handleFreeCellClick = (index: number) => {
    if (selection?.kind === 'freeCell' && selection.index === index) {
      setSelection(null)
      setStatusMessage('Selection cleared.')
      return
    }

    if (selection) {
      const nextGame = moveSelectionToFreeCell(game, selection, index)

      if (nextGame) {
        commitMove(nextGame, getMoveSummary(selection, `free cell ${index + 1}`))
        return
      }
    }

    const nextSelection = buildFreeCellSelection(game, index)

    if (nextSelection) {
      select(nextSelection)
      return
    }

    setStatusMessage(
      selection
        ? 'Free cells hold exactly one card, and only single cards can move into them.'
        : 'That free cell is empty.',
    )
  }

  const handleFoundationClick = (suit: Suit) => {
    if (!selection) {
      setStatusMessage(`Select a single card before using the ${SUIT_SYMBOLS[suit]} foundation.`)
      return
    }

    moveSelectionToHome(selection, suit)
  }

  const handleAutoFoundation = () => {
    const source =
      selection && canMoveSelectionToFoundation(game, selection)
        ? selection
        : findFirstFoundationMove(game)

    if (!source) {
      setStatusMessage('No exposed cards can move to a foundation right now.')
      return
    }

    moveSelectionToHome(source)
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Static web app • GitHub Pages ready</p>
          <h1>FreeCell Parlour</h1>
          <p className="lede">
            A browser-first take on the Windows classic with original styling, no backend,
            and no licensed assets.
          </p>
        </div>

        <div className="hero-metrics">
          <article className="metric-card">
            <span className="metric-card__label">Moves</span>
            <strong>{game.moves}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Time</span>
            <strong>{formatTime(elapsedSeconds)}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Solved</span>
            <strong>{progress}%</strong>
          </article>
        </div>
      </header>

      <section className="control-panel">
        <div className="controls">
          <button
            type="button"
            className="action-button action-button--primary"
            onClick={startNewDeal}
          >
            New deal
          </button>
          <button
            type="button"
            className="action-button"
            onClick={undoMove}
            disabled={history.length === 0}
          >
            Undo
          </button>
          <button type="button" className="action-button" onClick={handleAutoFoundation}>
            Auto home
          </button>
        </div>

        <div className="table-stats">
          <span>{emptyFreeCells} open free cells</span>
          <span>{emptyCascades} empty cascades</span>
          <span>Up to {transferCapacity} cards movable with current space</span>
        </div>
      </section>

      <p className={`status-banner ${won ? 'status-banner--won' : ''}`}>{statusMessage}</p>

      <main className="board-frame">
        <section className="zone-strip">
          <section className="zone-card">
            <div className="zone-card__header">
              <div>
                <p className="zone-card__eyebrow">Reserve</p>
                <h2>Free Cells</h2>
              </div>
              <span>{emptyFreeCells} available</span>
            </div>

            <div className="slot-grid">
              {game.freeCells.map((card, index) => {
                const isSelected = freeCellIsSelected(selection, index)
                const isDropTarget = selection
                  ? canMoveSelectionToFreeCell(game, selection, index)
                  : false

                return (
                  <button
                    key={`free-cell-${index}`}
                    type="button"
                    className={[
                      'cell-slot',
                      isSelected ? 'cell-slot--selected' : '',
                      isDropTarget ? 'cell-slot--target' : '',
                      card ? `playing-card playing-card--${card.color}` : 'cell-slot--empty',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleFreeCellClick(index)}
                    onDoubleClick={() => {
                      const source = buildFreeCellSelection(game, index)

                      if (source) {
                        moveSelectionToHome(source)
                      }
                    }}
                  >
                    {card ? (
                      <CardFace card={card} />
                    ) : (
                      <>
                        <span className="slot-label">Open</span>
                        <span className="slot-symbol">+</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="zone-card">
            <div className="zone-card__header">
              <div>
                <p className="zone-card__eyebrow">Goal</p>
                <h2>Foundations</h2>
              </div>
              <span>{solvedCards}/52 home</span>
            </div>

            <div className="slot-grid">
              {FOUNDATION_SLOTS.map((suit) => {
                const pile = game.foundations[suit]
                const topCard = pile[pile.length - 1]
                const isDropTarget = selection
                  ? canMoveSelectionToFoundation(game, selection, suit)
                  : false

                return (
                  <button
                    key={`foundation-${suit}`}
                    type="button"
                    className={[
                      'cell-slot',
                      'cell-slot--foundation',
                      isDropTarget ? 'cell-slot--target' : '',
                      topCard
                        ? `playing-card playing-card--${topCard.color}`
                        : 'cell-slot--empty',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleFoundationClick(suit)}
                  >
                    {topCard ? (
                      <CardFace card={topCard} />
                    ) : (
                      <>
                        <span className="slot-label">{suit}</span>
                        <span className="slot-symbol">{SUIT_SYMBOLS[suit]}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        </section>

        <section className="cascades-panel">
          {game.cascades.map((cascade, column) => {
            const cascadeHeight = Math.max(
              168,
              128 + Math.max(cascade.length - 1, 0) * STACK_SPACING,
            )
            const isDropTarget = selection
              ? canMoveSelectionToCascade(game, selection, column)
              : false

            return (
              <article key={`cascade-${column}`} className="cascade-column">
                <button
                  type="button"
                  className={`column-target ${isDropTarget ? 'column-target--active' : ''}`}
                  onClick={() => moveSelectionToColumn(column)}
                >
                  Cascade {column + 1}
                </button>

                <div
                  className={[
                    'cascade-stack',
                    cascade.length === 0 ? 'cascade-stack--empty' : '',
                    isDropTarget ? 'cascade-stack--target' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ height: cascadeHeight }}
                >
                  {cascade.length === 0 ? (
                    <button
                      type="button"
                      className="empty-cascade"
                      onClick={() => moveSelectionToColumn(column)}
                    >
                      Move here
                    </button>
                  ) : (
                    cascade.map((card, index) => (
                      <button
                        key={card.id}
                        type="button"
                        className={[
                          'playing-card',
                          `playing-card--${card.color}`,
                          'playing-card--stacked',
                          cardIsSelected(selection, column, index)
                            ? 'playing-card--selected'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ top: index * STACK_SPACING, zIndex: index + 1 }}
                        onClick={(event) => handleCascadeCardClick(event, column, index)}
                        onDoubleClick={(event) =>
                          handleCascadeCardDoubleClick(event, column, index)
                        }
                      >
                        <CardFace card={card} />
                      </button>
                    ))
                  )}
                </div>
              </article>
            )
          })}
        </section>

        <section className="notes-panel">
          <article>
            <h3>How to play</h3>
            <p>
              Build cascades downward in alternating colors, move single cards into open free
              cells, and send every suit from Ace to King into the foundations.
            </p>
          </article>
          <article>
            <h3>Quick tip</h3>
            <p>
              Double-click any exposed single card to send it home when the move is legal, or
              use Auto home for the next available foundation move.
            </p>
          </article>
          <article>
            <h3>Deploy</h3>
            <p>
              This project ships as static files, so GitHub Pages works directly. Vercel works
              too without extra server configuration.
            </p>
          </article>
        </section>
      </main>
    </div>
  )
}

export default App
