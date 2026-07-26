const appEl = document.getElementById('app');

const MODE_LABELS = {
  leisure: 'じっくり',
  'time-attack': '1問タイムアタック',
  'three-questions': '3問タイムアタック',
  challenge: '3分チャレンジ',
};

const CHIP_COLORS = [
  { id: 'orange', label: 'オレンジ', swatch: '#ffb066' },
  { id: 'blue', label: 'ブルー', swatch: '#7db8ff' },
  { id: 'green', label: 'グリーン', swatch: '#7ed9a8' },
  { id: 'pink', label: 'ピンク', swatch: '#ffa8c6' },
  { id: 'purple', label: 'パープル', swatch: '#c7abf7' },
];

const CHALLENGE_TITLES = [
  { min: 0, max: 0, title: 'はじめの一歩', text: '最後まであきらめずに考えたね！次は最初の1問クリアを目指そう！' },
  { min: 1, max: 1, title: 'ナイススタート', text: 'まずは1問クリア！数字のつながりが見えてきたね！' },
  { min: 2, max: 2, title: 'ひらめきルーキー', text: '2問クリア！積と和を上手に使えているよ！' },
  { min: 3, max: 3, title: 'ロジックファイター', text: '3問突破！難しくなっても正しく考えられたね！' },
  { min: 4, max: 4, title: 'ナンバーハンター', text: '4問クリアはすごい！数字の組合せを見つける力が鋭い！' },
  { min: 5, max: 5, title: 'ロジックマスター', text: '固定マス1個の問題に到達！見事な計算力と推理力！' },
  { min: 6, max: 6, title: 'ナンバーエース', text: '6問突破！速さと正確さの両方がすばらしい！' },
  { min: 7, max: Infinity, title: 'パズルレジェンド', text: '驚異の記録！数字の迷宮を完全に攻略したね！' },
];

const appState = {
  screen: 'title',
  mode: null,
  puzzleSize: 'easy',
  puzzlePool: {},
  currentPuzzle: null,
  boardValues: [],
  fixedCells: [],
  initialFixedCells: [],
  selectedValue: null,
  selectedCellIndex: null,
  message: '',
  hintCount: 0,
  timer: new PuzzleTimer(),
  countdown: null,
  countdownTimer: null,
  uiTickTimer: null,
  challengeTimer: null,
  challengeCountdown: null,
  challengeQuestionNumber: 1,
  challengeMistakeThisPuzzle: false,
  challengeFinished: false,
  threeQuestionProgress: 0,
  threeQuestionTimes: [],
  challengeStats: { clearCount: 0, correctCells: 0, noMistakeClears: 0, noMistakeStreak: 0, bestNoMistakeStreak: 0 },
  resultPreviousBest: null,
  resultElapsed: 0,
  isNewRecord: false,
  resultChallenge: null,
  reveal: null,
  records: readRecords(),
  settings: readSettings(),
  boardShake: false,
  lastPuzzleKey: null,
  lastRecordMessage: '',
};

let dragCtx = null;
// Timestamp-based, not a sticky boolean: some browsers fire a synthetic
// "click" on the drop target immediately after a completed drag, which would
// otherwise double-process the drop (e.g. re-selecting the cell just filled).
// The window only needs to be a few tens of ms to catch that same-gesture
// echo — long enough to swallow it, far too short to ever eat a deliberate
// next tap (e.g. pressing 解答する right after placing the last number by
// dragging), unlike a plain boolean flag which can get stuck "on" forever if
// the browser never fires that click at all (observed on touch, since
// preventDefault() during the drag suppresses it) and then silently swallow
// the next unrelated tap anywhere on screen.
let lastDragEndAt = 0;
const CLICK_SUPPRESS_WINDOW_MS = 80;
let audioCtx = null;

function init() {
  bindGlobalEvents();
  setupBackgroundNumbers();
  loadPuzzleData();
  render();
}

// Decorative "1..9 drifting toward the upper-right" backdrop for the title
// and mode-selection screens. Built once into a persistent container (a
// sibling of #app, untouched by render()'s innerHTML swaps) so the drift
// animation never restarts as the player navigates between screens.
function setupBackgroundNumbers() {
  const container = document.getElementById('bg-numbers');
  if (!container) return;
  const palette = ['var(--accent)', 'var(--mint)', 'var(--gold)'];
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('span');
    el.className = 'bg-number';
    el.textContent = String((i % 9) + 1);
    const size = 28 + Math.random() * 42;
    const duration = 28 + Math.random() * 20;
    el.style.left = `${Math.random() * 100}%`;
    el.style.top = `${100 + Math.random() * 30}%`;
    el.style.fontSize = `${size}px`;
    el.style.color = palette[i % palette.length];
    el.style.opacity = '0.32';
    el.style.animationDuration = `${duration}s`;
    el.style.animationDelay = `-${(Math.random() * duration).toFixed(2)}s`;
    container.appendChild(el);
  }
}

async function loadPuzzleData() {
  const [easy, standard] = await Promise.all([
    fetch('data/puzzles-3x2.json').then((response) => response.json()),
    fetch('data/puzzles-3x3.json').then((response) => response.json()),
  ]);
  appState.puzzlePool = { easy, standard };
  render();
}

function bindGlobalEvents() {
  appEl.addEventListener('click', handleClick);
  appEl.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove, { passive: false });
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerCancel);
}

function handleClick(event) {
  if (Date.now() - lastDragEndAt < CLICK_SUPPRESS_WINDOW_MS) return;
  ensureAudio();
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === 'select-cell' || action === 'number') {
    playTapSound();
  } else {
    playClickSound();
  }
  switch (action) {
    case 'show-howto': appState.screen = 'howto'; break;
    case 'show-records': appState.screen = 'records'; break;
    case 'show-settings': appState.screen = 'settings'; break;
    case 'select-size': appState.puzzleSize = actionEl.dataset.size; appState.screen = 'play-style'; break;
    case 'play-style': appState.mode = actionEl.dataset.mode; startGame(); break;
    case 'back':
      clearIntervalsOnly();
      if (appState.screen === 'play-style') appState.screen = 'title';
      else appState.screen = 'title';
      break;
    case 'select-cell': { const cellIndex = Number(actionEl.dataset.index); handleCellTap(cellIndex); break; }
    case 'number': { const value = Number(actionEl.dataset.value); handleNumberTap(value); break; }
    case 'reset': resetBoard(); break;
    case 'hint': useHint(); break;
    case 'submit': submitAnswer(); break;
    case 'next-puzzle': startGame(); break;
    case 'play-again': if (appState.mode === 'challenge') startChallenge(); else startGame(); break;
    case 'title-again': clearIntervalsOnly(); appState.screen = 'title'; break;
    case 'toggle-sound': appState.settings.sound = !appState.settings.sound; saveSettings(appState.settings); break;
    case 'set-chip-color': appState.settings.chipColor = actionEl.dataset.color; saveSettings(appState.settings); break;
    case 'reset-records': if (confirm('これまでの記録をすべて消しますか？')) { appState.records = resetRecords(); } break;
    case 'start-challenge': appState.mode = 'challenge'; startChallenge(); break;
    default: break;
  }
  render();
}

// --- Drag & drop (Pointer Events cover mouse / touch / pen alike) ---

function handlePointerDown(event) {
  if (appState.screen !== 'game') return;
  ensureAudio();
  const chipEl = event.target.closest('.number-chip');
  const cellEl = event.target.closest('.board-cell');
  if (chipEl && !chipEl.classList.contains('used')) {
    dragCtx = { source: 'panel', value: Number(chipEl.dataset.value), fromIndex: null, startX: event.clientX, startY: event.clientY, pointerId: event.pointerId, dragging: false, ghostEl: null };
  } else if (cellEl && cellEl.classList.contains('occupied') && !cellEl.classList.contains('fixed')) {
    const index = Number(cellEl.dataset.index);
    dragCtx = { source: 'cell', value: appState.boardValues[index], fromIndex: index, startX: event.clientX, startY: event.clientY, pointerId: event.pointerId, dragging: false, ghostEl: null };
  }
}

function handlePointerMove(event) {
  if (!dragCtx || dragCtx.pointerId !== event.pointerId) return;
  const dx = event.clientX - dragCtx.startX;
  const dy = event.clientY - dragCtx.startY;
  if (!dragCtx.dragging && Math.hypot(dx, dy) > 6) {
    dragCtx.dragging = true;
    dragCtx.ghostEl = document.createElement('div');
    dragCtx.ghostEl.className = 'drag-ghost';
    dragCtx.ghostEl.textContent = String(dragCtx.value);
    document.body.appendChild(dragCtx.ghostEl);
    playPickupSound();
  }
  if (dragCtx.dragging) {
    event.preventDefault();
    dragCtx.ghostEl.style.left = `${event.clientX}px`;
    dragCtx.ghostEl.style.top = `${event.clientY}px`;
  }
}

function handlePointerUp(event) {
  if (!dragCtx || dragCtx.pointerId !== event.pointerId) return;
  const ctx = dragCtx;
  dragCtx = null;
  if (!ctx.dragging) return;
  if (ctx.ghostEl) ctx.ghostEl.remove();
  playDropSound();
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const cellEl = target && target.closest('.board-cell');
  if (cellEl && !cellEl.classList.contains('fixed')) {
    const targetIndex = Number(cellEl.dataset.index);
    if (ctx.source === 'panel') {
      placeValue(targetIndex, ctx.value);
    } else if (ctx.source === 'cell' && ctx.fromIndex !== targetIndex) {
      swapCells(ctx.fromIndex, targetIndex);
      appState.message = '';
    }
  } else if (ctx.source === 'cell') {
    // Dropped outside any cell (e.g. back onto the number panel) - send the
    // number back to its original tray slot instead of leaving it in place.
    appState.boardValues[ctx.fromIndex] = null;
    appState.message = '';
  }
  lastDragEndAt = Date.now();
  render();
}

function handlePointerCancel(event) {
  if (dragCtx && dragCtx.pointerId === event.pointerId) {
    if (dragCtx.ghostEl) dragCtx.ghostEl.remove();
    dragCtx = null;
  }
}

// --- Board interaction (tap mode) ---

function handleCellTap(index) {
  if (appState.fixedCells.includes(index)) return;
  const cellValue = appState.boardValues[index];
  if (appState.selectedCellIndex !== null) {
    if (index === appState.selectedCellIndex) {
      // Tapping the already-selected cell again sends its number back to
      // the panel, instead of just cancelling the selection.
      appState.boardValues[index] = null;
      appState.selectedCellIndex = null;
      appState.message = '';
      render();
      return;
    }
    swapCells(appState.selectedCellIndex, index);
    appState.selectedCellIndex = null;
    appState.selectedValue = null;
    appState.message = '';
    render();
    return;
  }
  if (appState.selectedValue !== null) {
    placeValue(index, appState.selectedValue);
    return;
  }
  if (cellValue !== null) {
    appState.selectedCellIndex = index;
    appState.selectedValue = null;
    appState.message = '';
  }
  render();
}

function handleNumberTap(value) {
  // Already-placed numbers (including ones locked into a fixed cell) are
  // moved by tapping their cell on the board, not by re-selecting them here.
  if (appState.boardValues.includes(value)) return;
  appState.selectedValue = value;
  appState.selectedCellIndex = null;
  render();
}

function swapCells(fromIndex, toIndex) {
  if (appState.fixedCells.includes(fromIndex) || appState.fixedCells.includes(toIndex)) return;
  const temp = appState.boardValues[toIndex];
  appState.boardValues[toIndex] = appState.boardValues[fromIndex];
  appState.boardValues[fromIndex] = temp;
}

function placeValue(index, value) {
  if (appState.fixedCells.includes(index)) return;
  if (value === null || value === undefined) return;
  const existingIndex = appState.boardValues.indexOf(value);
  // That number is locked into a fixed cell elsewhere on the board — it
  // can't be relocated, so refuse the placement instead of overwriting it.
  if (existingIndex >= 0 && appState.fixedCells.includes(existingIndex)) return;
  const existingValue = appState.boardValues[index];
  if (existingIndex >= 0 && existingIndex !== index) {
    appState.boardValues[existingIndex] = existingValue;
  }
  appState.boardValues[index] = value;
  appState.selectedValue = null;
  appState.message = '';
  render();
}

function resetBoard() {
  appState.fixedCells = Array.from(appState.initialFixedCells);
  appState.boardValues = appState.boardValues.map((value, index) => (
    appState.fixedCells.includes(index) ? appState.currentPuzzle.answer[index] : null
  ));
  appState.selectedValue = null;
  appState.selectedCellIndex = null;
  appState.hintCount = 0;
  appState.message = '';
  render();
}

function useHint() {
  if (appState.mode !== 'leisure' || appState.hintCount >= 3) return;
  const answer = appState.currentPuzzle.answer;
  const emptyIndex = appState.boardValues.findIndex((value) => value === null);

  let targetIndex = emptyIndex;
  if (targetIndex < 0) {
    const allCorrect = appState.boardValues.every((value, index) => value === answer[index]);
    if (allCorrect) {
      appState.message = '解答するボタンを押そう！';
      render();
      setTimeout(() => {
        if (appState.message === '解答するボタンを押そう！') {
          appState.message = '';
          render();
        }
      }, 1500);
      return;
    }
    // Every cell is filled but at least one is wrong: clear that cell (its
    // number goes back to the panel) and let the hint fill it in instead.
    targetIndex = appState.boardValues.findIndex((value, index) => value !== answer[index] && !appState.fixedCells.includes(index));
    if (targetIndex < 0) return;
  }

  const hintValue = answer[targetIndex];
  // If that number is already sitting (misplaced) in some other cell, clear
  // it there first so the hint doesn't create a duplicate on the board.
  const duplicateIndex = appState.boardValues.findIndex((value, index) => value === hintValue && index !== targetIndex && !appState.fixedCells.includes(index));
  if (duplicateIndex >= 0) {
    appState.boardValues[duplicateIndex] = null;
  }

  appState.boardValues[targetIndex] = hintValue;
  appState.fixedCells.push(targetIndex);
  appState.hintCount += 1;
  render();
}

// --- Puzzle lifecycle helpers ---

function getCurrentBoardModeKey() {
  return appState.mode === 'challenge' ? 'standard' : appState.puzzleSize;
}

function applyPuzzleState(puzzleState) {
  appState.boardValues = puzzleState.values;
  appState.fixedCells = Array.from(puzzleState.fixed);
  appState.initialFixedCells = Array.from(puzzleState.fixed);
  appState.selectedValue = null;
  appState.selectedCellIndex = null;
}

function getChallengeFixedCount(questionNumber) {
  if (questionNumber === 1) return 5;
  if (questionNumber === 2) return 4;
  if (questionNumber === 3) return 3;
  if (questionNumber === 4) return 2;
  return 1;
}

function getNextPuzzle(sizeOverride = null) {
  const chooseSize = sizeOverride || appState.puzzleSize;
  const poolKey = chooseSize === 'easy' ? 'easy' : 'standard';
  let pool = appState.puzzlePool[poolKey];
  if (appState.mode !== 'challenge') {
    const midPool = pool.filter((puzzle) => puzzle.difficulty >= 2 && puzzle.difficulty <= 4);
    if (midPool.length > 0) pool = midPool;
  }
  const candidates = pool.filter((puzzle) => puzzle.id !== appState.lastPuzzleKey);
  const selected = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
  appState.lastPuzzleKey = selected.id;
  return selected;
}

function getTimeAttackRecordKey(size, questions) {
  if (size === 'easy') return questions === 1 ? 'easy1' : 'easy3';
  return questions === 1 ? 'standard1' : 'standard3';
}

function getChallengeTitle(clearCount) {
  return CHALLENGE_TITLES.find((entry) => clearCount >= entry.min && clearCount <= entry.max) || CHALLENGE_TITLES[0];
}

function getHintStars(hintCount) {
  if (hintCount <= 0) return '★★★';
  if (hintCount === 1) return '★★☆';
  return '★☆☆';
}

// --- Timers ---

function clearIntervalsOnly() {
  if (appState.countdownTimer) { clearInterval(appState.countdownTimer); appState.countdownTimer = null; }
  if (appState.challengeTimer) { clearInterval(appState.challengeTimer); appState.challengeTimer = null; }
  stopUiTicker();
}

function stopTimer() {
  if (appState.timer.running) appState.timer.stop();
}

function startUiTicker() {
  stopUiTicker();
  appState.uiTickTimer = setInterval(() => {
    if (appState.screen === 'game') render();
  }, 500);
}

function stopUiTicker() {
  if (appState.uiTickTimer) { clearInterval(appState.uiTickTimer); appState.uiTickTimer = null; }
}

function startCountdown(onComplete) {
  // じっくり has no clock to race against, so it skips straight to "START!"
  // instead of ticking through 3, 2, 1.
  const countdownValues = appState.mode === 'leisure' ? ['START!'] : ['3', '2', '1', 'START!'];
  const playBeatSound = (index) => {
    if (index === countdownValues.length - 1) playCountdownGoSound(); else playCountdownTickSound();
  };
  appState.screen = 'countdown';
  appState.countdown = countdownValues[0];
  playBeatSound(0);
  render();
  let index = 0;
  if (appState.countdownTimer) clearInterval(appState.countdownTimer);
  appState.countdownTimer = setInterval(() => {
    index += 1;
    if (index < countdownValues.length) {
      appState.countdown = countdownValues[index];
      playBeatSound(index);
      render();
    } else {
      clearInterval(appState.countdownTimer);
      appState.countdownTimer = null;
      appState.countdown = null;
      if (onComplete) onComplete();
      render();
    }
  }, 900);
}

// --- Game flow ---

function startGame() {
  clearIntervalsOnly();
  appState.message = '';
  appState.hintCount = 0;
  appState.boardShake = false;
  appState.lastRecordMessage = '';
  appState.timer.reset();
  if (appState.mode === 'three-questions') {
    appState.threeQuestionProgress = 0;
    appState.threeQuestionTimes = [];
  }
  appState.currentPuzzle = getNextPuzzle();
  applyPuzzleState(createPuzzleState(appState.currentPuzzle, appState.puzzleSize));
  startCountdown(() => {
    appState.screen = 'game';
    if (appState.mode === 'time-attack' || appState.mode === 'three-questions') {
      appState.timer.start();
      startUiTicker();
    }
  });
}

function startChallenge() {
  clearIntervalsOnly();
  appState.mode = 'challenge';
  appState.puzzleSize = 'standard';
  appState.message = '';
  appState.boardShake = false;
  appState.lastRecordMessage = '';
  appState.challengeQuestionNumber = 1;
  appState.challengeMistakeThisPuzzle = false;
  appState.challengeFinished = false;
  appState.challengeStats = { clearCount: 0, correctCells: 0, noMistakeClears: 0, noMistakeStreak: 0, bestNoMistakeStreak: 0 };
  appState.currentPuzzle = getNextPuzzle('standard');
  applyPuzzleState(createPuzzleState(appState.currentPuzzle, 'standard', getChallengeFixedCount(appState.challengeQuestionNumber)));
  appState.challengeCountdown = new CountdownTimer(180);
  startCountdown(() => {
    appState.screen = 'game';
    appState.challengeCountdown.start();
    appState.challengeTimer = setInterval(() => {
      if (appState.screen === 'game' && appState.challengeCountdown.isFinished() && !appState.challengeFinished) {
        finishChallenge();
      } else {
        render();
      }
    }, 250);
  });
}

function submitAnswer() {
  const boardModeKey = getCurrentBoardModeKey();
  const result = checkSolution(appState.boardValues, appState.currentPuzzle, boardModeKey);
  if (result.valid) {
    onCorrectAnswer();
  } else {
    onWrongAnswer();
  }
}

function onCorrectAnswer() {
  const boardModeKey = getCurrentBoardModeKey();
  const snapshotValues = appState.boardValues.slice();
  const snapshotPuzzle = appState.currentPuzzle;
  if (appState.mode === 'challenge') {
    appState.challengeCountdown.pause();
  } else {
    stopTimer();
  }
  startReveal(snapshotValues, snapshotPuzzle, boardModeKey, finishCorrectFlow);
}

function startReveal(values, puzzle, boardModeKey, onDoneCallback) {
  const { rowsText, colsText } = buildRevealTexts(values, puzzle, boardModeKey);
  const baseDurations = { leisure: 1800, 'time-attack': 2500, 'three-questions': 2500, challenge: 2500 };
  const duration = baseDurations[appState.mode] || 1000;
  appState.reveal = { rowsText, colsText, duration };
  appState.screen = 'reveal';
  playCorrectSound();
  render();
  setTimeout(onDoneCallback, duration);
}

function finishCorrectFlow() {
  if (appState.mode === 'leisure') {
    appState.screen = 'result';
    render();
    return;
  }

  if (appState.mode === 'time-attack') {
    const elapsed = appState.timer.getElapsedSeconds();
    const recordKey = getTimeAttackRecordKey(appState.puzzleSize, 1);
    const previous = appState.records.timeAttack[recordKey];
    appState.resultPreviousBest = previous;
    appState.resultElapsed = elapsed;
    appState.isNewRecord = previous === null || elapsed < previous;
    if (appState.isNewRecord) {
      appState.records.timeAttack[recordKey] = elapsed;
      saveRecords(appState.records);
    }
    stopUiTicker();
    appState.screen = 'result';
    render();
    return;
  }

  if (appState.mode === 'three-questions') {
    appState.threeQuestionTimes.push(appState.timer.getElapsedSeconds());
    appState.threeQuestionProgress += 1;
    if (appState.threeQuestionProgress < 3) {
      appState.message = '';
      appState.currentPuzzle = getNextPuzzle();
      applyPuzzleState(createPuzzleState(appState.currentPuzzle, appState.puzzleSize));
      appState.timer.reset();
      appState.timer.start();
      appState.screen = 'game';
      render();
      return;
    }
    const totalElapsed = appState.threeQuestionTimes.reduce((a, b) => a + b, 0);
    const recordKey = getTimeAttackRecordKey(appState.puzzleSize, 3);
    const previous = appState.records.timeAttack[recordKey];
    appState.resultPreviousBest = previous;
    appState.resultElapsed = totalElapsed;
    appState.isNewRecord = previous === null || totalElapsed < previous;
    if (appState.isNewRecord) {
      appState.records.timeAttack[recordKey] = totalElapsed;
      saveRecords(appState.records);
    }
    stopUiTicker();
    appState.screen = 'result';
    render();
    return;
  }

  if (appState.mode === 'challenge') {
    const stats = appState.challengeStats;
    const totalCells = appState.boardValues.length;
    stats.clearCount += 1;
    stats.correctCells += totalCells - appState.fixedCells.length;
    if (!appState.challengeMistakeThisPuzzle) {
      stats.noMistakeClears += 1;
      stats.noMistakeStreak += 1;
      stats.bestNoMistakeStreak = Math.max(stats.bestNoMistakeStreak, stats.noMistakeStreak);
    } else {
      stats.noMistakeStreak = 0;
    }
    if (appState.challengeCountdown.isFinished()) {
      finishChallenge();
      return;
    }
    appState.challengeCountdown.resume();
    appState.message = '';
    appState.challengeQuestionNumber += 1;
    appState.challengeMistakeThisPuzzle = false;
    appState.currentPuzzle = getNextPuzzle('standard');
    applyPuzzleState(createPuzzleState(appState.currentPuzzle, 'standard', getChallengeFixedCount(appState.challengeQuestionNumber)));
    appState.screen = 'game';
    render();
  }
}

function onWrongAnswer() {
  appState.message = 'おしい！どこかがちがうよ。\nもう一度見直してみよう！';
  if (appState.mode === 'challenge') appState.challengeMistakeThisPuzzle = true;
  playWrongSound();
  appState.boardShake = true;
  setTimeout(() => { appState.boardShake = false; render(); }, 300);
  render();
}

function finishChallenge() {
  if (appState.challengeFinished) return;
  appState.challengeFinished = true;
  if (appState.challengeTimer) { clearInterval(appState.challengeTimer); appState.challengeTimer = null; }
  appState.challengeCountdown.stop();
  const stats = appState.challengeStats;
  const records = appState.records;
  records.threeMinute.playCount += 1;
  const isFirstEver = records.threeMinute.playCount === 1;
  const newBest = stats.clearCount > records.threeMinute.bestClearCount;
  records.threeMinute.bestClearCount = Math.max(records.threeMinute.bestClearCount, stats.clearCount);
  records.threeMinute.bestCorrectCells = Math.max(records.threeMinute.bestCorrectCells, stats.correctCells);
  records.threeMinute.bestStreak = Math.max(records.threeMinute.bestStreak, stats.bestNoMistakeStreak);
  saveRecords(records);
  appState.resultChallenge = {
    titleInfo: getChallengeTitle(stats.clearCount),
    isNewRecord: newBest,
    allNoMistake: stats.clearCount > 0 && stats.noMistakeClears === stats.clearCount,
    reachedFixedOne: stats.clearCount >= 5,
    isFirstEver,
  };
  appState.screen = 'result';
  render();
}

// --- Sound (Web Audio, no external asset files needed) ---

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (AudioCtor) audioCtx = new AudioCtor();
}

function playTone(freq, durationMs, type) {
  if (!appState.settings.sound || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.03);
}

// A quick major-chord run climbing exactly one octave (C5 -> C6) for a
// richer, more celebratory feel than a simple two-note chime.
function playCorrectSound() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, index) => {
    setTimeout(() => playTone(freq, 150, 'triangle'), index * 85);
  });
}

function playWrongSound() {
  playTone(240, 220, 'sine');
}

// General button/menu press (mode select, back, reset, hint, submit, etc.).
function playClickSound() {
  playTone(520, 70, 'triangle');
}

// Tapping a number chip or a board cell directly (no drag involved).
function playTapSound() {
  playTone(760, 55, 'triangle');
}

// Picking a number chip up to start a drag.
function playPickupSound() {
  playTone(480, 55, 'square');
}

// Letting go of a dragged number chip, whether or not it lands on a cell.
function playDropSound() {
  playTone(680, 90, 'square');
}

// "3", "2", "1" ticks before a game starts.
function playCountdownTickSound() {
  playTone(500, 110, 'square');
}

// The final "START!" beat of the countdown.
function playCountdownGoSound() {
  playTone(700, 100, 'square');
  setTimeout(() => playTone(1000, 220, 'square'), 100);
}

// --- Formatting ---

function formatResultTime(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  return `${safe.toFixed(1)}秒`;
}

// In-game live timer/countdown: whole seconds, no minutes (matches the
// result/record screens' no-minutes style, just without the decimal - that
// stays reserved for formatResultTime so final times keep their precision).
function formatLiveTime(totalSeconds) {
  const safe = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  return `${safe}秒`;
}

function formatMessage(message) {
  return (message || '')
    .split('\n')
    .map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .join('<br>');
}

// --- Rendering ---

function render() {
  document.body.classList.toggle('bg-numbers-active', appState.screen === 'title' || appState.screen === 'play-style');
  document.body.dataset.chipColor = appState.settings.chipColor;
  if ((!appState.puzzlePool || !appState.puzzlePool.easy) && appState.screen === 'game') {
    appEl.innerHTML = '<div class="card"><p>読み込み中...</p></div>';
    return;
  }
  switch (appState.screen) {
    case 'title': renderTitle(); break;
    case 'play-style': renderPlayStyle(); break;
    case 'howto': renderHowTo(); break;
    case 'records': renderRecords(); break;
    case 'settings': renderSettings(); break;
    case 'countdown': renderCountdown(); break;
    case 'game': renderGame(); break;
    case 'reveal': renderReveal(); break;
    case 'result': renderResult(); break;
    default: renderTitle(); break;
  }
}

function renderTitle() {
  appEl.innerHTML = `
    <div class="card screen-title translucent-card">
      <div class="hero">
        <div class="badge">積と和で解くロジックゲーム</div>
        <h1>かけ×たし+パネル</h1>
        <p class="subtitle">積と和のヒントから表を完成させよう！</p>
      </div>
      <div class="button-grid">
        <button class="primary-btn main-mode-btn" data-action="select-size" data-size="easy">イージー</button>
        <button class="primary-btn main-mode-btn" data-action="select-size" data-size="standard">スタンダード</button>
        <button class="secondary-btn main-mode-btn" data-action="start-challenge">3分チャレンジ</button>
      </div>
      <div class="button-grid sub-grid">
        <button class="ghost-btn small-btn" data-action="show-howto">遊び方</button>
        <button class="ghost-btn small-btn" data-action="show-records">記録</button>
        <button class="ghost-btn small-btn" data-action="show-settings">設定</button>
      </div>
      <p class="copyright">©2026 T.TAKEMOTO / KEC Glows</p>
    </div>`;
}

function renderPlayStyle() {
  appEl.innerHTML = `
    <div class="card translucent-card">
      <nav class="topbar"><button class="back" data-action="back">← もどる</button><span class="mode-label">遊び方をえらぼう</span></nav>
      <div class="button-grid">
        <div class="mode-option">
          <button class="primary-btn" data-action="play-style" data-mode="leisure">じっくり</button>
          <p class="small">時間を気にせず、じっくり考えよう</p>
        </div>
        <div class="mode-option">
          <button class="secondary-btn" data-action="play-style" data-mode="time-attack">1問タイムアタック</button>
          <p class="small">1問のクリアタイムに挑戦</p>
        </div>
        <div class="mode-option">
          <button class="secondary-btn" data-action="play-style" data-mode="three-questions">3問タイムアタック</button>
          <p class="small">3問の合計タイムに挑戦</p>
        </div>
      </div>
    </div>`;
}

function renderRulesBody() {
  return `
    <div class="tutorial-card">
      <ol class="rule-list">
        <li>数字は1回ずつしか使えません。</li>
        <li>横のマスは「かけ算」。並んだ数をすべてかけると、左側の数になります。</li>
        <li>たてのマスは「たし算」。並んだ数をすべて足すと、上側の数になります。</li>
        <li>数字はドラッグ、またはタップして好きなマスに置けます。</li>
        <li>全部のマスが埋まったら「解答する」を押して確かめよう。</li>
      </ol>
      <div class="tutorial-example">
        ${renderBoardGrid(3, 2, [5, 7, 9], [15, 48], [1, 5, 3, 4, 2, 6].map((value, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          return `<div class="board-cell occupied" style="grid-column: ${col + 3}; grid-row: ${row + 3};"><span class="cell-value">${value}</span></div>`;
        }).join(''))}
      </div>
    </div>`;
}

function renderHowTo() {
  appEl.innerHTML = `
    <div class="card">
      <nav class="topbar"><button class="back" data-action="back">← もどる</button><span class="mode-label">遊び方</span></nav>
      ${renderRulesBody()}
    </div>`;
}

function renderRecords() {
  const records = appState.records;
  const fmt = (value) => (value === null || value === undefined ? '未記録' : formatResultTime(value));
  const rows = [
    ['イージー 1問', fmt(records.timeAttack.easy1)],
    ['イージー 3問', fmt(records.timeAttack.easy3)],
    ['スタンダード 1問', fmt(records.timeAttack.standard1)],
    ['スタンダード 3問', fmt(records.timeAttack.standard3)],
    ['3分チャレンジ 最高クリア数', `${records.threeMinute.bestClearCount}問`],
    ['3分チャレンジ 最高連続ノーミス', `${records.threeMinute.bestStreak}問`],
  ];
  appEl.innerHTML = `
    <div class="card">
      <nav class="topbar"><button class="back" data-action="back">← もどる</button><span class="mode-label">記録</span></nav>
      <div class="table-list">
        ${rows.map(([label, value]) => `<span class="record-label">${label}</span><span class="record-value">：${value}</span>`).join('')}
      </div>
      <button class="secondary-btn" data-action="reset-records">記録をリセット</button>
    </div>`;
}

function renderSettings() {
  appEl.innerHTML = `
    <div class="card">
      <nav class="topbar"><button class="back" data-action="back">← もどる</button><span class="mode-label">設定</span></nav>
      <div class="setting-item">
        <span>効果音</span>
        <button class="small-btn ${appState.settings.sound ? 'primary-btn' : 'ghost-btn'}" data-action="toggle-sound">${appState.settings.sound ? 'オン' : 'オフ'}</button>
      </div>
      <div class="setting-item setting-item-stacked">
        <span>数字パネルの色</span>
        <div class="chip-color-picker">
          ${CHIP_COLORS.map((color) => `<button class="chip-color-swatch ${appState.settings.chipColor === color.id ? 'selected' : ''}" style="background:${color.swatch};" data-action="set-chip-color" data-color="${color.id}" aria-label="${color.label}"></button>`).join('')}
        </div>
      </div>
      <div class="setting-item">
        <span>記録をリセット</span>
        <button class="small-btn secondary-btn" data-action="reset-records">リセット</button>
      </div>
    </div>`;
}

// Builds the puzzle grid together with its column-sum (top) and row-product
// (left) labels as ONE CSS grid, sharing a single `gap`. That guarantees the
// labels line up exactly with their column/row and that every inter-cell gap
// (horizontal and vertical alike) is identical, since it is all one grid
// rather than several independently-sized ones trying to visually coincide.
function renderBoardGrid(cols, rows, columnSums, rowProducts, cellsHtml) {
  const track = `clamp(48px, 16vw, 64px)`;
  return `
    <div class="board-grid" style="grid-template-columns: max-content max-content repeat(${cols}, ${track}); grid-template-rows: max-content max-content repeat(${rows}, ${track});">
      <div class="group-label col-group-label" style="grid-column: 3 / -1; grid-row: 1;">たての和</div>
      ${columnSums.map((value, i) => `<div class="axis-label col-label" style="grid-column: ${i + 3}; grid-row: 2;">${value}</div>`).join('')}
      <div class="group-label row-group-label" style="grid-column: 1; grid-row: 3 / -1;">横の積</div>
      ${rowProducts.map((value, i) => `<div class="axis-label row-label" style="grid-column: 2; grid-row: ${i + 3};">${value}</div>`).join('')}
      <div class="board-panel-bg" style="grid-column: 3 / -1; grid-row: 3 / -1;"></div>
      ${cellsHtml}
    </div>`;
}

function renderCountdown() {
  const isGo = appState.countdown === 'START!';
  appEl.innerHTML = `
    <div class="countdown-overlay">
      <div class="countdown-number ${isGo ? 'go' : ''}">${appState.countdown}</div>
    </div>`;
}

function renderGame() {
  const boardModeKey = getCurrentBoardModeKey();
  const board = getBoardDefinition(boardModeKey);
  const header = MODE_LABELS[appState.mode] || '';
  const currentRows = appState.currentPuzzle.rowProducts;
  const currentCols = appState.currentPuzzle.columnSums;
  const numbers = boardModeKey === 'easy' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const selectedIndex = appState.selectedCellIndex;
  const allFilled = appState.boardValues.every((value) => value !== null);

  let timerHtml;
  if (appState.mode === 'challenge') {
    const remaining = appState.challengeCountdown ? appState.challengeCountdown.getRemainingSeconds() : 180;
    const urgency = remaining <= 10 ? 'danger' : remaining <= 30 ? 'warn' : '';
    timerHtml = `<span class="badge timer ${urgency}">残り ${formatLiveTime(remaining)}</span>`;
  } else if (appState.mode === 'time-attack' || appState.mode === 'three-questions') {
    timerHtml = `<span class="badge timer">${formatLiveTime(appState.timer.getElapsedSeconds())}</span>`;
  } else {
    timerHtml = '';
  }

  let progressBadge = null;
  if (appState.mode === 'three-questions') {
    progressBadge = `第${appState.threeQuestionProgress + 1}問`;
  } else if (appState.mode === 'challenge') {
    progressBadge = `第${appState.challengeQuestionNumber}問`;
  }

  const hintButton = appState.mode === 'leisure'
    ? `<button class="ghost-btn" data-action="hint" ${appState.hintCount >= 3 ? 'disabled' : ''}>ヒント${appState.hintCount > 0 ? `(${appState.hintCount}/3)` : ''}</button>`
    : '';

  appEl.innerHTML = `
    <div class="card game-card">
      <nav class="topbar">
        <button class="back" data-action="back">← もどる</button>
        ${progressBadge ? `<span class="badge">${progressBadge}</span>` : ''}
        ${timerHtml}
      </nav>
      <p class="mode-label">${getBoardSize(boardModeKey) === '3x2' ? 'イージー 3×2' : 'スタンダード 3×3'}　${header}</p>
      ${renderBoardGrid(board.cols, board.rows, currentCols, currentRows, appState.boardValues.map((value, index) => {
        const row = Math.floor(index / board.cols);
        const col = index % board.cols;
        const fixed = appState.fixedCells.includes(index);
        const selected = index === selectedIndex;
        return `<button class="board-cell ${fixed ? 'fixed' : ''} ${value !== null ? 'occupied' : ''} ${selected ? 'selected' : ''} ${appState.boardShake ? 'shake' : ''}" style="grid-column: ${col + 3}; grid-row: ${row + 3};" data-action="select-cell" data-index="${index}">
          <span class="cell-value">${value ?? ''}</span>
        </button>`;
      }).join(''))}
      <div class="number-panel">
        ${numbers.map((number) => {
          const used = appState.boardValues.includes(number);
          return `<button class="number-chip ${used ? 'used' : ''} ${appState.selectedValue === number ? 'selected' : ''}" data-action="number" data-value="${number}">${number}</button>`;
        }).join('')}
      </div>
      <div class="controls">
        <button class="ghost-btn" data-action="reset">リセット</button>
        ${hintButton}
        <button class="primary-btn" data-action="submit" ${allFilled ? '' : 'disabled'}>解答する</button>
      </div>
      <div class="message">${formatMessage(appState.message)}</div>
    </div>`;
}

function renderReveal() {
  const reveal = appState.reveal;
  const items = [...reveal.rowsText, ...reveal.colsText];
  const step = reveal.duration / (items.length + 1);
  appEl.innerHTML = `
    <div class="card reveal-card">
      <h2>正解！</h2>
      <div class="reveal-list">
        ${items.map((text, index) => `<div class="reveal-item" style="animation-delay:${Math.round(index * step)}ms">${text}　✓</div>`).join('')}
      </div>
    </div>`;
}

function renderResult() {
  let inner = '';
  if (appState.mode === 'leisure') {
    inner = `
      <h2>正解！</h2>
      <p class="star-rating">${getHintStars(appState.hintCount)}</p>
      <p class="small">よく考えたね！</p>
      <div class="row">
        <button class="primary-btn" data-action="next-puzzle">もう1問</button>
        <button class="ghost-btn" data-action="title-again">タイトルにもどる</button>
      </div>`;
  } else if (appState.mode === 'time-attack') {
    const best = appState.resultPreviousBest;
    inner = `
      <h2>1問クリア！</h2>
      <div class="list">
        <div>クリアタイム　${formatResultTime(appState.resultElapsed)}</div>
        <div>自己ベスト　　${best === null || best === undefined ? '初挑戦' : formatResultTime(best)}</div>
      </div>
      ${appState.isNewRecord ? '<p class="record-badge">自己ベスト更新！</p>' : ''}
      <div class="row">
        <button class="primary-btn" data-action="play-again">もう1回</button>
        <button class="ghost-btn" data-action="title-again">タイトルへ</button>
      </div>`;
  } else if (appState.mode === 'three-questions') {
    const best = appState.resultPreviousBest;
    const questionLines = appState.threeQuestionTimes.map((time, index) => `<div>第${index + 1}問　${formatResultTime(time)}</div>`).join('');
    inner = `
      <h2>3問クリア！</h2>
      <div class="list">
        <div>合計タイム　${formatResultTime(appState.resultElapsed)}</div>
        ${questionLines}
        <div>自己ベスト　${best === null || best === undefined ? '初挑戦' : formatResultTime(best)}</div>
      </div>
      ${appState.isNewRecord ? '<p class="record-badge">自己ベスト更新！</p>' : ''}
      <div class="row">
        <button class="primary-btn" data-action="play-again">もう1回</button>
        <button class="ghost-btn" data-action="title-again">タイトルへ</button>
      </div>`;
  } else if (appState.mode === 'challenge') {
    const stats = appState.challengeStats;
    const info = appState.resultChallenge;
    const extraMessages = [];
    if (info.isNewRecord) extraMessages.push('<p class="record-badge">自己ベスト更新！<br>前の自分を超えたぞ！</p>');
    if (info.allNoMistake) extraMessages.push('<p class="record-badge">パーフェクト思考！<br>一度も間違えずに答えを導けたね！</p>');
    if (info.reachedFixedOne) extraMessages.push('<p class="record-badge">完全推理成功！<br>たった1つの手掛かりから答えを完成させた！</p>');
    if (info.isFirstEver) extraMessages.push('<p class="record-badge">初チャレンジ完了！<br>まずは最後まで挑戦したことがすばらしい！</p>');
    inner = `
      <h2>${info.titleInfo.title}</h2>
      <p class="small">${info.titleInfo.text}</p>
      <div class="list">
        <div>クリア数　　　　${stats.clearCount}問</div>
        <div>正解したマス　　${stats.correctCells}マス</div>
        <div>ノーミスクリア　${stats.noMistakeClears}問</div>
        <div>最高連続正解　　${stats.bestNoMistakeStreak}問</div>
      </div>
      ${extraMessages.join('')}
      <div class="row">
        <button class="primary-btn" data-action="play-again">もう1回</button>
        <button class="ghost-btn" data-action="title-again">タイトルへ</button>
      </div>`;
  }
  appEl.innerHTML = `<div class="card result-card">${inner}</div>`;
}

window.addEventListener('load', init);
