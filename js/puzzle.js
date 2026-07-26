const BOARD_DEFINITIONS = {
  easy: { rows: 2, cols: 3, numbers: 6 },
  standard: { rows: 3, cols: 3, numbers: 9 },
};

function getBoardDefinition(mode) {
  return BOARD_DEFINITIONS[mode] || BOARD_DEFINITIONS.standard;
}

function getBoardSize(mode) {
  return mode === 'easy' ? '3x2' : '3x3';
}

function getExpectedDigits(size) {
  return Array.from({ length: size === '3x2' ? 6 : 9 }, (_, index) => index + 1);
}

function shuffleArray(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Choose `count` distinct cell indexes for fixed cells. When 2 or more are
// requested, retry a few times so the result spans at least two rows and
// two columns instead of clustering on one line.
function pickFixedPositions(count, rows, cols) {
  const totalCells = rows * cols;
  const safeCount = Math.min(count, totalCells);
  if (safeCount <= 1) {
    return [Math.floor(Math.random() * totalCells)];
  }
  const rowTarget = Math.min(2, rows);
  const colTarget = Math.min(2, cols);
  let best = null;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const positions = shuffleArray(Array.from({ length: totalCells }, (_, i) => i)).slice(0, safeCount);
    const rowsUsed = new Set(positions.map((p) => Math.floor(p / cols)));
    const colsUsed = new Set(positions.map((p) => p % cols));
    if (rowsUsed.size >= rowTarget && colsUsed.size >= colTarget) {
      return positions;
    }
    if (!best || rowsUsed.size + colsUsed.size > best.score) {
      best = { positions, score: rowsUsed.size + colsUsed.size };
    }
  }
  return best.positions;
}

function createPuzzleState(puzzle, mode, fixedCount = 0) {
  const board = getBoardDefinition(mode);
  const totalCells = board.rows * board.cols;
  const values = Array(totalCells).fill(null);
  const fixed = new Set();
  const answer = puzzle.answer.slice();
  if (fixedCount > 0) {
    const positions = pickFixedPositions(fixedCount, board.rows, board.cols);
    positions.forEach((index) => {
      values[index] = answer[index];
      fixed.add(index);
    });
  }
  return { values, fixed };
}

function checkSolution(values, puzzle, mode) {
  const board = getBoardDefinition(mode);
  const expectedDigits = getExpectedDigits(getBoardSize(mode));
  const usedDigits = values.filter((value) => value !== null);
  if (usedDigits.length !== expectedDigits.length) {
    return { valid: false, reason: 'incomplete' };
  }
  if (new Set(usedDigits).size !== expectedDigits.length) {
    return { valid: false, reason: 'duplicate' };
  }
  const sortedDigits = [...usedDigits].sort((a, b) => a - b);
  if (sortedDigits.join(',') !== expectedDigits.join(',')) {
    return { valid: false, reason: 'digits' };
  }
  const rows = [];
  for (let row = 0; row < board.rows; row += 1) {
    const rowValues = values.slice(row * board.cols, row * board.cols + board.cols);
    rows.push(rowValues.reduce((acc, current) => acc * current, 1));
  }
  const cols = [];
  for (let col = 0; col < board.cols; col += 1) {
    const colValues = [];
    for (let row = 0; row < board.rows; row += 1) {
      colValues.push(values[row * board.cols + col]);
    }
    cols.push(colValues.reduce((acc, current) => acc + current, 0));
  }
  const valid = rows.every((value, index) => value === puzzle.rowProducts[index])
    && cols.every((value, index) => value === puzzle.columnSums[index]);
  return { valid, rows, cols, reason: valid ? 'ok' : 'mismatch' };
}

// Builds the "9x1x7=63 v" style text used in the correct-answer reveal.
function buildRevealTexts(values, puzzle, mode) {
  const board = getBoardDefinition(mode);
  const rowsText = [];
  for (let row = 0; row < board.rows; row += 1) {
    const rowValues = values.slice(row * board.cols, row * board.cols + board.cols);
    rowsText.push(`${rowValues.join('×')}＝${puzzle.rowProducts[row]}`);
  }
  const colsText = [];
  for (let col = 0; col < board.cols; col += 1) {
    const colValues = [];
    for (let row = 0; row < board.rows; row += 1) {
      colValues.push(values[row * board.cols + col]);
    }
    colsText.push(`${colValues.join('＋')}＝${puzzle.columnSums[col]}`);
  }
  return { rowsText, colsText };
}
