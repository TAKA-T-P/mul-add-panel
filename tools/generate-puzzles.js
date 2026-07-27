const fs = require('fs');
const path = require('path');

function permute(values) {
  const result = [];
  function backtrack(current, remaining) {
    if (current.length === values.length) {
      result.push([...current]);
      return;
    }
    for (let i = 0; i < remaining.length; i += 1) {
      const next = remaining.slice();
      const [value] = next.splice(i, 1);
      current.push(value);
      backtrack(current, next);
      current.pop();
    }
  }
  backtrack([], values);
  return result;
}

function computeHints(arr, rows, cols) {
  const rowProducts = [];
  for (let row = 0; row < rows; row += 1) {
    const start = row * cols;
    rowProducts.push(arr.slice(start, start + cols).reduce((acc, item) => acc * item, 1));
  }
  const columnSums = [];
  for (let col = 0; col < cols; col += 1) {
    const sum = arr.filter((_, index) => index % cols === col).reduce((acc, item) => acc + item, 0);
    columnSums.push(sum);
  }
  return { rowProducts, columnSums };
}

// Counts how many distinct unordered subsets of `length` values from `pool`
// combine (via + or *) to the target. This measures how ambiguous a single
// clue is in isolation (ignoring the cross constraints from other clues),
// which we use as a rough difficulty signal: more candidate subsets per
// clue means more branching to search through before the unique overall
// solution can be pinned down.
function countCombinations(target, length, pool, op) {
  let count = 0;
  function helper(startIdx, remaining, acc) {
    if (acc > target && op === 'add') return;
    if (remaining === 0) {
      if (acc === target) count += 1;
      return;
    }
    for (let i = startIdx; i < pool.length; i += 1) {
      helper(i + 1, remaining - 1, op === 'mul' ? acc * pool[i] : acc + pool[i]);
    }
  }
  helper(0, length, op === 'mul' ? 1 : 0);
  return count;
}

function scoreDifficulty(rowProducts, columnSums, numbers, rows, cols) {
  let branching = 0;
  rowProducts.forEach((product) => {
    branching += countCombinations(product, cols, numbers, 'mul') - 1;
  });
  columnSums.forEach((sum) => {
    branching += countCombinations(sum, rows, numbers, 'add') - 1;
  });
  return branching;
}

// For each (rowIndex, colIndex) pair, maps "the signature of the other 4
// hints" -> how many permutations of `numbers` share that signature. Used to
// find, for a given puzzle, which one row-product AND one column-sum can be
// hidden together while the remaining 4 hints still pin down a unique
// solution (the かくされたヒント mission hides exactly one of each). Built
// once per board size and reused across every candidate puzzle.
function buildHiddenHintPairMaps(all, rows, cols) {
  const maps = Array.from({ length: rows }, () => Array.from({ length: cols }, () => new Map()));
  all.forEach((arr) => {
    const { rowProducts, columnSums } = computeHints(arr, rows, cols);
    for (let r = 0; r < rows; r += 1) {
      const restRows = rowProducts.filter((_, i) => i !== r);
      for (let c = 0; c < cols; c += 1) {
        const restCols = columnSums.filter((_, i) => i !== c);
        const key = `${restRows.join(',')}|${restCols.join(',')}`;
        const map = maps[r][c];
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
  });
  return maps;
}

function computeHiddenHintPairs(entry, maps, rows, cols) {
  const pairs = [];
  for (let r = 0; r < rows; r += 1) {
    const restRows = entry.rowProducts.filter((_, i) => i !== r);
    for (let c = 0; c < cols; c += 1) {
      const restCols = entry.columnSums.filter((_, i) => i !== c);
      const key = `${restRows.join(',')}|${restCols.join(',')}`;
      const count = maps[r][c].get(key) || 0;
      if (count === 1) pairs.push({ rowIndex: r, colIndex: c });
    }
  }
  return pairs;
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildPuzzles(sizeLabel, numbers, rows, cols, targetCount, withHiddenHints = false) {
  const all = permute(numbers);
  const signatures = new Map();
  all.forEach((arr) => {
    const { rowProducts, columnSums } = computeHints(arr, rows, cols);
    const signature = `${rowProducts.join(',')}|${columnSums.join(',')}`;
    if (!signatures.has(signature)) signatures.set(signature, []);
    signatures.get(signature).push(arr);
  });

  // Only keep clue-sets with exactly one matching arrangement: a unique solution.
  const unique = [];
  signatures.forEach((arrs) => {
    if (arrs.length === 1) {
      const answer = arrs[0];
      const { rowProducts, columnSums } = computeHints(answer, rows, cols);
      const score = scoreDifficulty(rowProducts, columnSums, numbers, rows, cols);
      unique.push({ answer, rowProducts, columnSums, score });
    }
  });

  // Bucket by difficulty score quantile (1 = easiest, 5 = hardest) and
  // sample roughly evenly across buckets so the pool isn't skewed toward
  // one extreme, then trim/relabel extreme outliers out of the normal range.
  const sorted = unique.slice().sort((a, b) => a.score - b.score);
  const bucketCount = 5;
  sorted.forEach((entry, index) => {
    entry.difficulty = Math.min(bucketCount, Math.floor((index / sorted.length) * bucketCount) + 1);
  });

  const buckets = Array.from({ length: bucketCount }, () => []);
  sorted.forEach((entry) => buckets[entry.difficulty - 1].push(entry));

  const perBucket = Math.ceil(targetCount / bucketCount);
  const selected = [];
  buckets.forEach((bucket) => {
    selected.push(...shuffle(bucket).slice(0, perBucket));
  });

  const finalList = shuffle(selected).slice(0, Math.min(targetCount, selected.length));
  const hiddenHintPairMaps = withHiddenHints ? buildHiddenHintPairMaps(all, rows, cols) : null;
  return finalList.map((entry, index) => ({
    id: `${sizeLabel}-${index + 1}`,
    answer: entry.answer,
    rowProducts: entry.rowProducts,
    columnSums: entry.columnSums,
    difficulty: entry.difficulty,
    ...(withHiddenHints ? { hiddenHintPairs: computeHiddenHintPairs(entry, hiddenHintPairMaps, rows, cols) } : {}),
  }));
}

const outDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'puzzles-3x2.json'),
  JSON.stringify(buildPuzzles('3x2', [1, 2, 3, 4, 5, 6], 2, 3, 100), null, 2),
);
fs.writeFileSync(
  path.join(outDir, 'puzzles-3x3.json'),
  JSON.stringify(buildPuzzles('3x3', [1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3, 400, true), null, 2),
);

console.log('generated puzzle data');
