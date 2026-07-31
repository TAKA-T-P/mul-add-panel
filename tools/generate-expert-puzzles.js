// Generates puzzles for the エキスパート mission: a 4-row x 3-column board
// using 1-12 (横4行の積, 縦3列の和). 12! (479,001,600) is far too large to
// enumerate directly like the 3x2/3x3 generator does, so uniqueness is
// checked with a constrained backtracking search instead - see
// countSolutions() below.
const fs = require('fs');
const path = require('path');

const NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const ROWS = 4;
const COLS = 3;
const TARGET_COUNT = 150;
const MAX_ATTEMPTS = 200_000;
// Backtracking-node ceiling per candidate puzzle, so one pathological
// row-product combination can't hang the whole generation run.
const NODE_BUDGET = 150_000;

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// All 12C3 = 220 distinct-digit 3-combinations, indexed by their product -
// e.g. productCandidates.get(60) -> [[1,5,12], [2,5,6], ...].
function buildProductCandidates() {
  const map = new Map();
  for (let i = 0; i < NUMBERS.length; i += 1) {
    for (let j = i + 1; j < NUMBERS.length; j += 1) {
      for (let k = j + 1; k < NUMBERS.length; k += 1) {
        const combo = [NUMBERS[i], NUMBERS[j], NUMBERS[k]];
        const product = combo[0] * combo[1] * combo[2];
        if (!map.has(product)) map.set(product, []);
        map.get(product).push(combo);
      }
    }
  }
  return map;
}

const PRODUCT_CANDIDATES = buildProductCandidates();

function permute3(arr) {
  const [a, b, c] = arr;
  return [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];
}

function computeHints(answer) {
  const rowProducts = [];
  for (let row = 0; row < ROWS; row += 1) {
    const start = row * COLS;
    rowProducts.push(answer.slice(start, start + COLS).reduce((acc, v) => acc * v, 1));
  }
  const columnSums = [];
  for (let col = 0; col < COLS; col += 1) {
    let sum = 0;
    for (let row = 0; row < ROWS; row += 1) sum += answer[row * COLS + col];
    columnSums.push(sum);
  }
  return { rowProducts, columnSums };
}

// Counts up to `maxSolutions` distinct arrangements satisfying the given
// row products + column sums, without ever enumerating all 12! permutations:
// each row is only tried against its own product's candidate 3-digit sets
// (pruned so no two rows share a digit), and each row's 6 internal orderings
// are abandoned the moment a running column sum exceeds its target (sums
// only grow, so once too high it can never come back down). Stops the
// instant a 2nd solution is found - we only need to know "unique or not".
function countSolutions(rowProducts, columnSums, maxSolutions, nodeBudget) {
  const rowCandidateSets = rowProducts.map((p) => PRODUCT_CANDIDATES.get(p) || []);
  if (rowCandidateSets.some((list) => list.length === 0)) {
    return { count: 0, hitBudget: false };
  }

  let solutionCount = 0;
  let nodeCount = 0;
  let hitBudget = false;
  const usedDigits = new Set();
  const colSums = [0, 0, 0];

  function backtrack(rowIndex) {
    if (solutionCount >= maxSolutions || hitBudget) return;
    nodeCount += 1;
    if (nodeCount > nodeBudget) { hitBudget = true; return; }
    if (rowIndex === ROWS) {
      if (colSums[0] === columnSums[0] && colSums[1] === columnSums[1] && colSums[2] === columnSums[2]) {
        solutionCount += 1;
      }
      return;
    }
    for (const combo of rowCandidateSets[rowIndex]) {
      if (solutionCount >= maxSolutions || hitBudget) return;
      if (combo.some((d) => usedDigits.has(d))) continue;
      for (const perm of permute3(combo)) {
        if (solutionCount >= maxSolutions || hitBudget) return;
        const next0 = colSums[0] + perm[0];
        const next1 = colSums[1] + perm[1];
        const next2 = colSums[2] + perm[2];
        if (next0 > columnSums[0] || next1 > columnSums[1] || next2 > columnSums[2]) continue;
        combo.forEach((d) => usedDigits.add(d));
        const prev0 = colSums[0]; const prev1 = colSums[1]; const prev2 = colSums[2];
        colSums[0] = next0; colSums[1] = next1; colSums[2] = next2;
        backtrack(rowIndex + 1);
        colSums[0] = prev0; colSums[1] = prev1; colSums[2] = prev2;
        combo.forEach((d) => usedDigits.delete(d));
      }
    }
  }

  backtrack(0);
  return { count: solutionCount, hitBudget };
}

// Rough difficulty proxy: total candidate-combination count across all 4
// row products - more candidates per row means more branching a solver has
// to work through before the unique arrangement is pinned down.
function scoreDifficulty(rowProducts) {
  return rowProducts.reduce((sum, p) => sum + (PRODUCT_CANDIDATES.get(p) || []).length, 0);
}

function buildExpertPuzzles(targetCount) {
  const seenSignatures = new Set();
  const collected = [];
  let attempts = 0;
  let budgetSkips = 0;

  while (collected.length < targetCount && attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const answer = shuffle(NUMBERS);
    const { rowProducts, columnSums } = computeHints(answer);
    const signature = [...rowProducts, ...columnSums].join('-');
    if (seenSignatures.has(signature)) continue;

    const { count, hitBudget } = countSolutions(rowProducts, columnSums, 2, NODE_BUDGET);
    if (hitBudget) { budgetSkips += 1; continue; }
    if (count !== 1) continue;

    seenSignatures.add(signature);
    collected.push({ answer, rowProducts, columnSums, score: scoreDifficulty(rowProducts) });

    if (collected.length % 20 === 0) {
      console.log(`  ...${collected.length}/${targetCount} unique puzzles found (${attempts} attempts so far, ${budgetSkips} budget skips)`);
    }
  }

  if (collected.length < targetCount) {
    console.warn(`WARNING: only found ${collected.length}/${targetCount} unique エキスパート puzzles after ${attempts} attempts (${budgetSkips} budget skips). Consider raising MAX_ATTEMPTS or NODE_BUDGET.`);
  }

  // Bucket into 5 difficulty tiers by score quantile, then shuffle output
  // order so same-difficulty puzzles aren't grouped together in the file.
  const sorted = collected.slice().sort((a, b) => a.score - b.score);
  const bucketCount = 5;
  sorted.forEach((entry, index) => {
    entry.difficulty = Math.min(bucketCount, Math.floor((index / sorted.length) * bucketCount) + 1);
  });

  return shuffle(sorted).map((entry, index) => ({
    id: `expert-${index + 1}`,
    answer: entry.answer,
    rowProducts: entry.rowProducts,
    columnSums: entry.columnSums,
    difficulty: entry.difficulty,
  }));
}

const outDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });

console.log('Generating エキスパート (4x3, 1-12) puzzles via constrained backtracking...');
const startedAt = Date.now();
const puzzles = buildExpertPuzzles(TARGET_COUNT);
fs.writeFileSync(
  path.join(outDir, 'puzzles-4x3.json'),
  JSON.stringify(puzzles, null, 2),
);
const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`Done in ${elapsedSeconds}s: wrote ${puzzles.length} puzzles to data/puzzles-4x3.json`);
const diffCounts = {};
puzzles.forEach((p) => { diffCounts[p.difficulty] = (diffCounts[p.difficulty] || 0) + 1; });
console.log('Difficulty distribution:', diffCounts);
