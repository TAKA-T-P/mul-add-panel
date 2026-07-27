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

// All distinct-digit 3-number combinations from `pool` whose product is `target`.
// Every board row is exactly 3 cells wide (easy is 2x3, standard is 3x3), so
// this same helper covers both board types unchanged.
function findProductCombos(pool, target) {
  const combos = [];
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      for (let k = j + 1; k < pool.length; k += 1) {
        if (pool[i] * pool[j] * pool[k] === target) combos.push([pool[i], pool[j], pool[k]]);
      }
    }
  }
  return combos;
}

// Generates the "この問題のカギ" hint text shown after solving a puzzle
// (じっくり and select missions only). Picks whichever row-product gives the
// strongest starting foothold: among rows with only a single possible 3-digit
// combination, the one with the smallest product is named outright (a small
// unique product is the easiest one for a player to spot themselves);
// failing that (no row is uniquely determined), the row with the fewest
// candidate combinations is pointed to instead. Never claims uniqueness
// unless findProductCombos() actually confirms it. A generic column-sum tip
// is always appended, since knowing which 3 numbers belong in a row still
// leaves their order within it undetermined.
function buildPuzzleKey(puzzle, boardType) {
  const digitPool = getExpectedDigits(getBoardSize(boardType));
  const rows = puzzle.rowProducts;
  const rowCombos = rows.map((product) => findProductCombos(digitPool, product));
  let insightText;
  const uniqueIndices = rowCombos.reduce((acc, combos, index) => {
    if (combos.length === 1) acc.push(index);
    return acc;
  }, []);
  if (uniqueIndices.length > 0) {
    const bestIndex = uniqueIndices.reduce((best, index) => (
      rows[index] < rows[best] ? index : best
    ), uniqueIndices[0]);
    const combo = rowCombos[bestIndex][0];
    insightText = `積が${rows[bestIndex]}になるのは${combo.join('×')}。\nまず、この3枚が同じ横一列に入ると分かるよ！`;
  } else {
    const fewestIndex = rowCombos.reduce((best, combos, index) => (
      combos.length < rowCombos[best].length ? index : best
    ), 0);
    insightText = `積が${rows[fewestIndex]}になる組み合わせは限られているよ。\n候補の少ない横一列から考えるのがカギ！`;
  }
  const columnFollowup = '横に入る数字が分かったら、縦の和を使って並び順を決めよう！';
  return `${insightText}\n${columnFollowup}`;
}

// --- Mission puzzle generators (スタンダード3×3 only) ---

// あと3マス: 6 cells pre-filled with the answer, 3 left for the player. Reuses
// pickFixedPositions()'s row/column-spread logic, just inverted - the 3
// "spread" positions it picks become the empty ones instead of the fixed ones.
function createMissionThreeLeftState(puzzle) {
  const board = getBoardDefinition('standard');
  const totalCells = board.rows * board.cols;
  const emptyPositions = new Set(pickFixedPositions(3, board.rows, board.cols));
  const values = Array(totalCells).fill(null);
  const fixed = [];
  for (let index = 0; index < totalCells; index += 1) {
    if (!emptyPositions.has(index)) {
      values[index] = puzzle.answer[index];
      fixed.push(index);
    }
  }
  return { values, fixed, emptyIndices: Array.from(emptyPositions) };
}

// まちがいを直せ: the true answer with exactly 2 cells swapped, guaranteed to
// be in different rows AND columns. Since the two swapped values are always
// distinct, this necessarily changes both affected row products and both
// affected column sums - it can never accidentally look like a valid,
// differently-arranged solution.
function createMissionFixTheSwapState(puzzle) {
  const board = getBoardDefinition('standard');
  const totalCells = board.rows * board.cols;
  const cols = board.cols;
  let posA = 0;
  let posB = 0;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    posA = Math.floor(Math.random() * totalCells);
    const rowA = Math.floor(posA / cols);
    const colA = posA % cols;
    const candidates = [];
    for (let index = 0; index < totalCells; index += 1) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      if (row !== rowA && col !== colA) candidates.push(index);
    }
    if (candidates.length > 0) {
      posB = candidates[Math.floor(Math.random() * candidates.length)];
      break;
    }
  }
  const values = puzzle.answer.slice();
  [values[posA], values[posB]] = [values[posB], values[posA]];
  const mistakeRows = [Math.floor(posA / cols), Math.floor(posB / cols)];
  const mistakeCols = [posA % cols, posB % cols];
  return { values, mistakeRows, mistakeCols };
}

// 手数リミット: the answer with its 9 values shuffled across positions
// so that sorting it back requires between 2 and 4 swaps (cycle-decomposition
// minimum: cells - cycles). Puzzles outside that range are re-rolled so the
// challenge stays tight but achievable.
function countPermutationCycles(perm) {
  const visited = new Array(perm.length).fill(false);
  let cycles = 0;
  for (let i = 0; i < perm.length; i += 1) {
    if (visited[i]) continue;
    cycles += 1;
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      j = perm[j];
    }
  }
  return cycles;
}

function createMissionMoveLimitState(puzzle) {
  const board = getBoardDefinition('standard');
  const totalCells = board.rows * board.cols;
  let perm = Array.from({ length: totalCells }, (_, i) => i);
  let minSwaps = 0;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = shuffleArray(Array.from({ length: totalCells }, (_, i) => i));
    const swaps = totalCells - countPermutationCycles(candidate);
    if (swaps >= 2 && swaps <= 4) {
      perm = candidate;
      minSwaps = swaps;
      break;
    }
  }
  const values = perm.map((sourceIndex) => puzzle.answer[sourceIndex]);
  return { values, minSwaps };
}

// この問題のカギ text for the missions where it applies (not 手数リミット).
function buildMissionThreeLeftKey(puzzle, emptyIndices) {
  const missing = emptyIndices.map((index) => puzzle.answer[index]).sort((a, b) => a - b);
  return `残り3枚の数字は${missing.join('・')}。\n固定されていない3枚を確認しよう。横の積と縦の和の両方を使うと、3枚の場所を決められるよ！`;
}

const ROW_POSITION_WORDS = ['上', '真ん中', '下'];
const COL_POSITION_WORDS = ['左', '中央', '右'];

function buildMissionFixTheSwapKey(mistakeRows, mistakeCols) {
  const rowText = mistakeRows.map((row) => `${ROW_POSITION_WORDS[row]}の横一列`).join('と');
  const colText = mistakeCols.map((col) => `${COL_POSITION_WORDS[col]}の縦一列`).join('と');
  return `入れ替える前は、${rowText}・${colText}で数が合っていなかったよ。合わない行と列が交わる場所に注目するのがカギ！`;
}

// かくされたヒント hides one rowProduct AND one columnSum at once (a pair);
// the key explains both reveals in turn.
function buildMissionHiddenHintKey(puzzle, pair) {
  const board = getBoardDefinition('standard');
  const rowValues = puzzle.answer.slice(pair.rowIndex * board.cols, pair.rowIndex * board.cols + board.cols);
  const rowProduct = puzzle.rowProducts[pair.rowIndex];
  const colValues = [];
  for (let row = 0; row < board.rows; row += 1) colValues.push(puzzle.answer[row * board.cols + pair.colIndex]);
  const colSum = puzzle.columnSums[pair.colIndex];
  return `横の「？」の列は${rowValues.join('・')}。\n${rowValues.join('×')}＝${rowProduct}だから、横の「？」は${rowProduct}だね！\nたての「？」の列は${colValues.join('・')}。\n${colValues.join('+')}＝${colSum}だから、たての「？」は${colSum}だね！`;
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
