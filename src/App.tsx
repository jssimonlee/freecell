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

const STACK_SPACING = 48

const FOUNDATION_NAMES: Record<Suit, string> = {
  clubs: '클럽',
  diamonds: '다이아',
  hearts: '하트',
  spades: '스페이드',
}

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
    return `${describeCard(selection.cards[0])} 선택됨. 임시 칸, 완성 칸, 또는 다른 열을 누르세요.`
  }

  return `${describeCard(selection.cards[0])}부터 ${selection.cards.length}장을 선택했습니다. 이동할 열을 고르세요.`
}

function getMoveSummary(selection: Selection, destination: string) {
  if (selection.cards.length === 1) {
    return `${describeCard(selection.cards[0])} 카드를 ${destination}(으)로 옮겼습니다.`
  }

  return `${selection.cards.length}장의 연속 카드를 ${destination}(으)로 옮겼습니다.`
}

function cardIsSelected(selection: Selection | null, column: number, index: number) {
  return selection?.kind === 'cascade' && selection.column === column && index >= selection.startIndex
}

function freeCellIsSelected(selection: Selection | null, index: number) {
  return selection?.kind === 'freeCell' && selection.index === index
}

function getCascadeSearchOrder(totalColumns: number, sourceColumn?: number) {
  if (sourceColumn === undefined) {
    return Array.from({ length: totalColumns }, (_, index) => index)
  }

  const order: number[] = []

  for (let offset = 1; offset < totalColumns; offset += 1) {
    const leftColumn = sourceColumn - offset
    const rightColumn = sourceColumn + offset

    if (leftColumn >= 0) {
      order.push(leftColumn)
    }

    if (rightColumn < totalColumns) {
      order.push(rightColumn)
    }
  }

  return order
}

function CardFace({ card }: { card: Card }) {
  return (
    <>
      <span className="card-face__corner">
        <span>{card.rankText}</span>
        <span>{card.suitSymbol}</span>
      </span>
      <span className="card-face__center">
        <span className="card-face__rank">{card.rankText}</span>
        <span className="card-face__pip">{card.suitSymbol}</span>
      </span>
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
  const [statusMessage, setStatusMessage] = useState('열린 카드나 연결된 카드 묶음을 선택하세요.')

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
        ? `${nextGame.moves}번 이동, ${formatTime(currentElapsed)}만에 클리어했습니다.`
        : message,
    )
  }

  const startNewDeal = () => {
    setGame(createGame())
    setHistory([])
    setSelection(null)
    setStartedAt(Date.now())
    setElapsedSeconds(0)
    setStatusMessage('새 게임을 시작했습니다.')
  }

  const undoMove = () => {
    if (history.length === 0) {
      setStatusMessage('되돌릴 수 있는 이동이 없습니다.')
      return
    }

    const previousGame = history[history.length - 1]
    setHistory((previous) => previous.slice(0, -1))
    setGame(previousGame)
    setSelection(null)
    setStatusMessage('직전 이동을 되돌렸습니다.')
  }

  const select = (nextSelection: Selection) => {
    setSelection(nextSelection)
    setStatusMessage(describeSelection(nextSelection))
  }

  const moveSelectionToHome = (source: Selection, targetSuit?: Suit) => {
    const nextGame = moveSelectionToFoundation(game, source, targetSuit)

    if (!nextGame) {
      setStatusMessage('완성 칸에는 같은 무늬의 카드만 A부터 순서대로 올릴 수 있습니다.')
      return
    }

    commitMove(nextGame, getMoveSummary(source, '완성 칸'))
  }

  const moveSelectionToColumn = (column: number) => {
    if (!selection) {
      setStatusMessage('먼저 이동할 카드를 선택하세요.')
      return
    }

    const nextGame = moveSelectionToCascade(game, selection, column)

    if (!nextGame) {
      setStatusMessage('열은 색을 번갈아 내림차순으로만 놓을 수 있고, 긴 이동은 빈 칸 수에 따라 달라집니다.')
      return
    }

    commitMove(nextGame, getMoveSummary(selection, `${column + 1}열`))
  }

  const moveSelectionByPriority = (
    source: Selection,
    options: {
      sourceColumn?: number
      allowFoundation: boolean
      allowCascade: boolean
      allowFreeCell: boolean
    },
  ) => {
    if (options.allowFoundation) {
      const foundationMove = moveSelectionToFoundation(game, source)

      if (foundationMove) {
        commitMove(foundationMove, getMoveSummary(source, '완성 칸'))
        return true
      }
    }

    if (options.allowCascade) {
      const cascadeSearchOrder = getCascadeSearchOrder(
        game.cascades.length,
        options.sourceColumn,
      )

      for (const column of cascadeSearchOrder) {
        const cascadeMove = moveSelectionToCascade(game, source, column)

        if (cascadeMove) {
          commitMove(cascadeMove, getMoveSummary(source, `${column + 1}열`))
          return true
        }
      }
    }

    if (options.allowFreeCell) {
      for (let index = 0; index < game.freeCells.length; index += 1) {
        const freeCellMove = moveSelectionToFreeCell(game, source, index)

        if (freeCellMove) {
          commitMove(freeCellMove, getMoveSummary(source, `임시 칸 ${index + 1}`))
          return true
        }
      }
    }

    return false
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
      setStatusMessage('선택을 해제했습니다.')
      return
    }

    if (selection) {
      const nextGame = moveSelectionToCascade(game, selection, column)

      if (nextGame) {
        commitMove(nextGame, getMoveSummary(selection, `${column + 1}열`))
        return
      }
    }

    const nextSelection = buildCascadeSelection(game, column, index)

    if (!nextSelection) {
      setStatusMessage('열에서는 색이 번갈아 내려가는 카드 묶음만 선택할 수 있습니다.')
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
      const moved = moveSelectionByPriority(source, {
        sourceColumn: column,
        allowFoundation: true,
        allowCascade: true,
        allowFreeCell: true,
      })

      if (!moved) {
        setStatusMessage('자동으로 이동할 수 있는 완성 칸, 다른 열, 임시 칸이 없습니다.')
      }
    }
  }

  const handleFreeCellDoubleClick = (index: number) => {
    const source = buildFreeCellSelection(game, index)

    if (!source) {
      return
    }

    const moved = moveSelectionByPriority(source, {
      allowFoundation: false,
      allowCascade: true,
      allowFreeCell: false,
    })

    if (!moved) {
      setStatusMessage('임시 칸 카드가 내려갈 수 있는 열이 없습니다.')
    }
  }

  const handleFreeCellClick = (index: number) => {
    if (selection?.kind === 'freeCell' && selection.index === index) {
      setSelection(null)
      setStatusMessage('선택을 해제했습니다.')
      return
    }

    if (selection) {
      const nextGame = moveSelectionToFreeCell(game, selection, index)

      if (nextGame) {
        commitMove(nextGame, getMoveSummary(selection, `임시 칸 ${index + 1}`))
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
        ? '임시 칸에는 카드 1장만 놓을 수 있고, 한 번에 1장만 이동할 수 있습니다.'
        : '비어 있는 임시 칸입니다.',
    )
  }

  const handleFoundationClick = (suit: Suit) => {
    if (!selection) {
      setStatusMessage(`${FOUNDATION_NAMES[suit]} 완성 칸에 올릴 카드를 먼저 선택하세요.`)
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
      setStatusMessage('지금 바로 완성 칸으로 올릴 수 있는 카드가 없습니다.')
      return
    }

    moveSelectionToHome(source)
  }

  return (
    <div className="app-shell">
      <section className="top-panel">
        <header className="hero-panel">
          <div className="hero-copy">
            <h1>프리셀</h1>
          </div>

          <div className="hero-metrics">
            <article className="metric-card">
              <span className="metric-card__label">이동</span>
              <strong>{game.moves}</strong>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">시간</span>
              <strong>{formatTime(elapsedSeconds)}</strong>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">완료</span>
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
              새 게임
            </button>
            <button
              type="button"
              className="action-button"
              onClick={undoMove}
              disabled={history.length === 0}
            >
              되돌리기
            </button>
            <button type="button" className="action-button" onClick={handleAutoFoundation}>
              자동 올리기
            </button>
          </div>

          <div className="table-stats">
            <span>빈 임시 칸 {emptyFreeCells}</span>
            <span>빈 열 {emptyCascades}</span>
            <span>현재 최대 {transferCapacity}장 이동</span>
          </div>
        </section>
      </section>

      <p className={`status-banner ${won ? 'status-banner--won' : ''}`}>{statusMessage}</p>

      <main className="board-frame">
        <section className="zone-strip">
          <section className="zone-card">
            <div className="zone-card__header">
              <h2>임시 칸</h2>
              <span>{emptyFreeCells}칸 비어 있음</span>
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
                    onDoubleClick={() => handleFreeCellDoubleClick(index)}
                  >
                    {card ? (
                      <CardFace card={card} />
                    ) : (
                      <>
                        <span className="slot-label">빈칸</span>
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
              <h2>완성 칸</h2>
              <span>{solvedCards}/52장 완료</span>
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
                        <span className="slot-label">{FOUNDATION_NAMES[suit]}</span>
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
              210,
              150 + Math.max(cascade.length - 1, 0) * STACK_SPACING,
            )
            const isDropTarget = selection
              ? canMoveSelectionToCascade(game, selection, column)
              : false

            return (
              <article key={`cascade-${column}`} className="cascade-column">
                <div
                  className={[
                    'cascade-stack',
                    cascade.length === 0 ? 'cascade-stack--empty' : '',
                    isDropTarget ? 'cascade-stack--target' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ height: cascadeHeight }}
                  onClick={() => moveSelectionToColumn(column)}
                >
                  {cascade.length === 0 ? (
                    <span className="empty-cascade">이동</span>
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
      </main>
    </div>
  )
}

export default App
