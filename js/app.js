const appEl = document.getElementById('app');

const MODE_LABELS = {
  leisure: 'じっくり',
  'time-attack': '1問タイムアタック',
  'three-questions': '3問タイムアタック',
  challenge: '3分チャレンジ',
};

const MISSION_INFO = {
  threeLeft: { label: 'あと3マス', description: '超おてがる！残り3枚を正しい場所に入れよう！' },
  fixTheSwap: { label: 'まちがいを直せ', description: '2枚の数字が入れかわっているよ。正しく直そう！' },
  hiddenHint: { label: 'かくされたヒント', description: 'かくされた数字を推理して、全部のマスをうめよう！' },
  moveLimit: { label: '手数リミット', description: '決められた回数以内に、入れ替えだけで完成させよう！' },
};

// Fixed イージー3×2 example used by the tutorial - answer is 3,1,5 / 4,2,6,
// giving column sums 7,3,11 and row products 15,48 (matches the あそびかた
// diagram). Each step's `board` is what's shown filled in at that point;
// `highlightRows`/`highlightCols` mark which axis clues + cells to call out.
const TUTORIAL_BOARD = { cols: 3, rows: 2, columnSums: [7, 3, 11], rowProducts: [15, 48] };
const TUTORIAL_STEPS = [
  {
    text: '空いているマスに、1から6までの数字を1つずつ置いて、表を完成させよう！\n積（せき）はかけ算の答え、和（わ）はたし算の答えのことだよ。',
    board: [null, null, null, null, null, null],
    highlightRows: [],
    highlightCols: [],
  },
  {
    text: 'まず、横の積に注目しよう。\n積が15になるのは、1×3×5の組み合わせ。\nどの場所に どの数字が入るかな？',
    board: [null, null, null, null, null, null],
    highlightRows: [0],
    highlightCols: [],
  },
  {
    text: '次に、たての和に注目しよう。\n和が3になるのは、1+2の組み合わせだけ。\n真ん中の列は、上が1、下が2に決まるね。',
    board: [null, 1, null, null, 2, null],
    highlightRows: [],
    highlightCols: [1],
  },
  {
    text: 'さらに、和が11になるのは、5+6の組み合わせだけ。\n右の列は、上が5、下が6に決まるね。',
    board: [null, 1, 5, null, 2, 6],
    highlightRows: [],
    highlightCols: [2],
  },
  {
    text: '残りの数字は、左上に3、左下に4を置けば完成！',
    board: [3, 1, 5, 4, 2, 6],
    highlightRows: [],
    highlightCols: [0],
  },
  {
    text: 'このように、積や和のヒントから\n表を完成させるのが\nかけ×たし+パズルだよ！',
    board: [3, 1, 5, 4, 2, 6],
    highlightRows: [0, 1],
    highlightCols: [0, 1, 2],
  },
];

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
  { min: 7, max: 7, title: 'パズルレジェンド', text: '驚異の記録！数字の迷宮を完全に攻略したね！' },
  { min: 8, max: Infinity, title: 'かけ×たし+グランドマスター', text: '計算力・推理力・スピード、すべてが最高レベル！' },
];

// 1問あたりの基準時間(ms)。3問モードは合計を3で割った平均をこの基準と比べる。
const TIME_ATTACK_BASE_TIME_MS = {
  easy: 10_000,
  standard: 40_000,
};

// multiplier は「基準時間の何倍以内か」の上限。評価順に並んでいるので、
// 配列の先頭から見て最初に条件を満たした段位を採用する。
const TIME_ATTACK_RANKS = [
  { rank: 'MAX', multiplier: 1, title: 'かけ×たし+レジェンド', singleComment: '驚異のスピード！積と和のつながりを一瞬で見抜いたね！', tripleComment: '驚異のスピードで3問完全制覇！計算力も集中力も限界突破！' },
  { rank: 'SS', multiplier: 1.5, title: '超速ロジックマスター', singleComment: 'ものすごい速さでクリア！計算力もひらめきも最高クラス！', tripleComment: '圧倒的な速さで3問クリア！高い集中力を最後まで保てたね！' },
  { rank: 'S', multiplier: 2, title: '閃光ナンバーエース', singleComment: 'とても速い！数字の組み合わせを鋭く見つけられたね！', tripleComment: '3問を鮮やかに突破！数字を見抜く力がとても鋭い！' },
  { rank: 'A', multiplier: 2.5, title: 'ひらめき名人', singleComment: 'すばやく正確に完成！積と和を上手に使いこなせているね！', tripleComment: '3問続けてすばやく正解！安定した計算力と推理力だね！' },
  { rank: 'B', multiplier: 3, title: 'ロジックファイター', singleComment: 'ナイスクリア！条件を整理して、しっかり答えを導けたね！', tripleComment: '3問をテンポよく完成！条件を整理する力がしっかり身についているよ！' },
  { rank: 'C', multiplier: 4, title: 'じっくり推理家', singleComment: '落ち着いて考え、正解までたどり着けたね！その集中力がすばらしい！', tripleComment: '3問すべてクリア！落ち着いて一つずつ答えを導けたね！' },
  { rank: 'D', multiplier: 5, title: 'ねばりの探究者', singleComment: '何度も考えながら答えを見つけたね！ねばり強い推理が光っているよ！', tripleComment: '難しい3問にじっくり向き合い、最後まで解き切ったね！' },
  { rank: 'E', multiplier: 6, title: '不屈のチャレンジャー', singleComment: '難しい問題に最後まで向き合い、見事に解き切ったね！', tripleComment: '長い挑戦でもあきらめなかったね！その集中力とねばり強さがすばらしい！' },
  { rank: 'F', multiplier: Infinity, title: '未来のロジックマスター', singleComment: 'まずはクリアできたことが大きな一歩！次は今回の記録を少し超えてみよう！', tripleComment: '3問すべて完成させたことが大きな成果！次は少しずつタイムを縮めよう！' },
];

// Smart-clear evaluation: how cleanly the player reached the correct answer,
// independent of time. Priority order (best to worst) is oneShot > perfectLogic
// > noMistake > recovery - only the single best-matching tier is ever shown.
const SMART_CLEAR_TIER_RANK = { oneShot: 4, perfectLogic: 3, noMistake: 2, recovery: 1 };

const SMART_CLEAR_INFO = {
  oneShot: {
    comment: '一発配置！\n頭の中でしっかり考えてから、すべての数字を置けたね！',
    tripleComment: '3問すべて一発配置！先を読む力と正確さがすばらしい！',
  },
  perfectLogic: {
    comment: '完全推理！\n積と和を手がかりに、自分の力だけで答えを導き出したね！',
    tripleComment: '3問すべてヒントなし・ノーミス！安定した推理力だね！',
  },
  noMistake: {
    comment: 'ノーミスクリア！\n一度の解答で正解！条件を正確に確認できたね！',
    tripleComment: '3問を一度の解答で正解！最後まで正確に考えられたね！',
  },
  recovery: {
    comment: 'ナイスリカバリー！\n間違いを見直して、自分の力で正解に直せたね！',
    tripleComment: '間違いを見直しながら、3問すべてを最後まで解き切ったね！',
  },
};

// Resets the per-puzzle operation tracking used by evaluateSmartClear().
// Called whenever a fresh puzzle is put on screen (not on a manual reset,
// which instead just flags resetUsed so the attempt keeps being tracked).
function resetSmartClearTracking() {
  appState.smartClear = { hintUsed: false, resetUsed: false, wrongSubmitted: false, hasExtraMove: false, fillCount: 0 };
}

function evaluateSmartClear() {
  const sc = appState.smartClear;
  if (sc.wrongSubmitted) return 'recovery';
  if (!sc.hintUsed && !sc.resetUsed) {
    return sc.hasExtraMove ? 'perfectLogic' : 'oneShot';
  }
  return 'noMistake';
}

// Aggregates the three-question smart-clear tiers into one overall tier: the
// weakest of the three, since a triple-comment can only claim "all 3" did
// something if every single one of them actually qualified for it.
function getWorstSmartClearTier(tiers) {
  return tiers.reduce((worst, tier) => (
    SMART_CLEAR_TIER_RANK[tier] < SMART_CLEAR_TIER_RANK[worst] ? tier : worst
  ), tiers[0]);
}

// Shared by both 1問 and 3問 time-attack results. 3問 evaluates on the
// per-question average (totalTimeMs / 3), never the raw total, and never on
// the rounded/displayed time - always the actual measured milliseconds.
function getTimeAttackEvaluation({ boardType, questionCount, totalTimeMs }) {
  const baseTimeMs = TIME_ATTACK_BASE_TIME_MS[boardType];
  const evaluationTimeMs = questionCount === 3 ? totalTimeMs / 3 : totalTimeMs;
  const entry = TIME_ATTACK_RANKS.find((item) => evaluationTimeMs <= baseTimeMs * item.multiplier);
  return {
    rank: entry.rank,
    title: entry.title,
    comment: questionCount === 3 ? entry.tripleComment : entry.singleComment,
    evaluationTimeMs,
  };
}

const appState = {
  screen: 'title',
  mode: null,
  tutorialStepIndex: 0,
  tutorialOrigin: 'howto',
  puzzleSize: 'easy',
  puzzlePool: {},
  currentPuzzle: null,
  boardValues: [],
  fixedCells: [],
  initialFixedCells: [],
  wrongRowIndices: [],
  wrongColIndices: [],
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
  challengeAnyMistake: false,
  challengeCombo: 0,
  comboDisplayText: null,
  milestoneDisplayText: null,
  milestoneIsZone: false,
  correctMarkPhase: null,
  challengeFinished: false,
  challengeGracePeriodActive: false,
  challengeGraceCountdown: null,
  challengeLastBeepSecond: null,
  threeQuestionProgress: 0,
  threeQuestionTimes: [],
  threeQuestionSmartTiers: [],
  resultBoards: [],
  showResultHistory: false,
  showPuzzleKey: false,
  challengeStats: { clearCount: 0, correctCells: 0, noMistakeClears: 0, noMistakeStreak: 0, bestNoMistakeStreak: 0 },
  resultPreviousBest: null,
  resultElapsed: 0,
  isNewRecord: false,
  resultEvaluation: null,
  resultChallenge: null,
  resultSmartClear: null,
  resultStarTier: null,
  missionType: null,
  missionInitialValues: [],
  missionMistakeRows: [],
  missionMistakeCols: [],
  missionHintUsed: false,
  missionHintKind: null,
  missionHiddenPair: null,
  missionHiddenRowRevealed: false,
  missionMoveCount: 0,
  missionMinSwaps: 0,
  missionAllowedMoves: 0,
  resultMissionText: null,
  lastSmartClearTier: null,
  smartClear: { hintUsed: false, resetUsed: false, wrongSubmitted: false, hasExtraMove: false, fillCount: 0 },
  showCorrectMark: false,
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
  if (!appState.settings.tutorialSeen) {
    startTutorial('auto');
  }
  render();
}

// Marks the tutorial seen the moment it's opened (not just on completion) so
// that closing the tab mid-tutorial still counts - it won't auto-show again
// on the next launch either way.
function startTutorial(origin) {
  appState.tutorialOrigin = origin;
  appState.tutorialStepIndex = 0;
  appState.screen = 'tutorial';
  appState.settings.tutorialSeen = true;
  saveSettings(appState.settings);
}

function getTutorialExitScreen() {
  return appState.tutorialOrigin === 'howto' ? 'howto' : 'title';
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelActiveDrag();
  });
}

function handleClick(event) {
  if (Date.now() - lastDragEndAt < CLICK_SUPPRESS_WINDOW_MS) return;
  ensureAudio();
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === 'number') {
    playPanelSelectSound();
  } else if (action !== 'select-cell') {
    // select-cell plays its own sound inside handleCellTap(), since which
    // tone fits depends on which of its several sub-cases actually happens
    // (picking a placed number back up sounds different from placing/
    // swapping one into a cell).
    playClickSound();
  }
  switch (action) {
    case 'show-howto': appState.screen = 'howto'; break;
    case 'show-tutorial': startTutorial('howto'); break;
    case 'tutorial-prev': appState.tutorialStepIndex = Math.max(0, appState.tutorialStepIndex - 1); break;
    case 'tutorial-next': appState.tutorialStepIndex = Math.min(TUTORIAL_STEPS.length - 1, appState.tutorialStepIndex + 1); break;
    case 'tutorial-exit': appState.screen = getTutorialExitScreen(); break;
    case 'show-missions': appState.screen = 'mission-select'; break;
    case 'start-mission': startMission(actionEl.dataset.mission); break;
    case 'toggle-mission-hint': useMissionHint(); break;
    case 'show-records': appState.screen = 'records'; break;
    case 'show-settings': appState.screen = 'settings'; break;
    case 'select-size': appState.puzzleSize = actionEl.dataset.size; appState.screen = 'play-style'; break;
    case 'play-style': appState.mode = actionEl.dataset.mode; startGame(); break;
    case 'back':
      clearIntervalsOnly();
      if (appState.screen === 'game') {
        // From the game screen, go back one step to whichever selection
        // screen led here - not all the way to the title - since 3分チャレンジ
        // has no intermediate selection screen, it falls back to the title.
        if (appState.mode === 'mission') appState.screen = 'mission-select';
        else if (appState.mode === 'leisure' || appState.mode === 'time-attack' || appState.mode === 'three-questions') appState.screen = 'play-style';
        else appState.screen = 'title';
      } else {
        appState.screen = 'title';
      }
      break;
    case 'select-cell': { const cellIndex = Number(actionEl.dataset.index); handleCellTap(cellIndex); break; }
    case 'number': { const value = Number(actionEl.dataset.value); handleNumberTap(value); break; }
    case 'reset': resetBoard(); break;
    case 'hint': useHint(); break;
    case 'submit':
      // submitAnswer()'s own paths (startReveal / onWrongAnswer) already
      // render; falling through to the generic render() below would
      // immediately re-render the just-shown reveal screen a second time,
      // restarting its per-item fade-in animation from scratch.
      submitAnswer();
      return;
    case 'next-puzzle': startGame(); break;
    case 'play-again':
      if (appState.mode === 'challenge') startChallenge();
      else if (appState.mode === 'mission') startMission(appState.missionType);
      else startGame();
      break;
    case 'title-again': clearIntervalsOnly(); appState.screen = 'title'; break;
    case 'toggle-result-history': appState.showResultHistory = !appState.showResultHistory; break;
    case 'toggle-puzzle-key': appState.showPuzzleKey = !appState.showPuzzleKey; break;
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
  // A drag is already being tracked (e.g. a second finger touched the
  // screen while the first was mid-drag) - starting a new one here would
  // overwrite dragCtx and orphan the first pointer's ghost element, since
  // its pointerId would no longer match anything when it's eventually
  // released. Ignore any extra pointers until the current drag finishes.
  if (dragCtx) return;
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
      const swapped = swapCells(ctx.fromIndex, targetIndex);
      if (swapped) appState.message = '';
    }
  } else if (ctx.source === 'cell' && !isNoPanelMission()) {
    // Dropped outside any cell (e.g. back onto the number panel) - send the
    // number back to its original tray slot instead of leaving it in place.
    // Not applicable to the no-panel missions, which have no tray to return to.
    appState.boardValues[ctx.fromIndex] = null;
    appState.smartClear.hasExtraMove = true;
    appState.message = '';
  }
  lastDragEndAt = Date.now();
  render();
}

function handlePointerCancel(event) {
  if (dragCtx && dragCtx.pointerId === event.pointerId) {
    cancelActiveDrag();
  }
}

// Safety net for the rare case pointerup/pointercancel never arrives (e.g.
// the tab is backgrounded or an OS gesture takes over mid-drag) - without
// this the ghost chip could otherwise be left floating on screen forever.
function cancelActiveDrag() {
  if (dragCtx && dragCtx.ghostEl) dragCtx.ghostEl.remove();
  dragCtx = null;
}

// --- Board interaction (tap mode) ---

function handleCellTap(index) {
  if (appState.fixedCells.includes(index)) return;
  const cellValue = appState.boardValues[index];
  if (appState.selectedCellIndex !== null) {
    if (index === appState.selectedCellIndex) {
      // Tapping the already-selected cell again sends its number back to the
      // panel, instead of just cancelling the selection - except in the
      // no-panel missions, which have nowhere for it to go back to.
      playTapSound();
      if (!isNoPanelMission()) {
        appState.boardValues[index] = null;
        appState.smartClear.hasExtraMove = true;
      }
      appState.selectedCellIndex = null;
      appState.message = '';
      render();
      return;
    }
    playTapSound();
    const swapped = swapCells(appState.selectedCellIndex, index);
    appState.selectedCellIndex = null;
    appState.selectedValue = null;
    if (swapped) appState.message = '';
    render();
    return;
  }
  if (appState.selectedValue !== null) {
    playTapSound();
    placeValue(index, appState.selectedValue);
    return;
  }
  if (cellValue !== null) {
    // Picking an already-placed number back up (not a swap) sounds like
    // selecting from the panel, since it's the same kind of action - marking
    // a number as "held" rather than moving one into place.
    playPanelSelectSound();
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

// Returns whether the swap actually happened (false if refused, e.g. a
// fixed-cell target or an exhausted 手数リミット move budget) so callers
// know whether it's safe to clear appState.message.
function swapCells(fromIndex, toIndex) {
  if (appState.fixedCells.includes(fromIndex) || appState.fixedCells.includes(toIndex)) return false;
  if (appState.mode === 'mission' && appState.missionType === 'moveLimit') {
    const remaining = appState.missionAllowedMoves - appState.missionMoveCount;
    if (remaining <= 0) {
      appState.message = '移動回数を使い切ったよ。答えを確認するか、リセットしよう！';
      return false;
    }
  }
  if (appState.mode === 'mission') appState.missionMoveCount += 1;
  appState.smartClear.hasExtraMove = true;
  const temp = appState.boardValues[toIndex];
  appState.boardValues[toIndex] = appState.boardValues[fromIndex];
  appState.boardValues[fromIndex] = temp;
  return true;
}

// True for missions where the board is always fully occupied and swapping is
// the only legal move - no number panel exists to draw from or return to.
function isNoPanelMission() {
  return appState.mode === 'mission' && (appState.missionType === 'fixTheSwap' || appState.missionType === 'moveLimit');
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
    appState.smartClear.hasExtraMove = true;
  } else if (existingValue !== null) {
    appState.smartClear.hasExtraMove = true;
  } else {
    appState.smartClear.fillCount += 1;
  }
  if (appState.mode === 'mission') appState.missionMoveCount += 1;
  appState.boardValues[index] = value;
  appState.selectedValue = null;
  appState.message = '';
  render();
}

function resetBoard() {
  if (isNoPanelMission()) {
    // まちがいを直せ / 手数リミット: there's no "answer minus fixed cells"
    // to fall back on - restore the exact initial (wrong/shuffled) layout.
    // A 手数リミット hint-fixed cell (see useMissionHint()) is unlocked again
    // by a reset - missionHintUsed stays true, though, so the hint itself
    // isn't refunded.
    appState.boardValues = appState.missionInitialValues.slice();
    appState.fixedCells = [];
    appState.missionMoveCount = 0;
  } else {
    appState.fixedCells = Array.from(appState.initialFixedCells);
    appState.boardValues = appState.boardValues.map((value, index) => (
      appState.fixedCells.includes(index) ? appState.currentPuzzle.answer[index] : null
    ));
  }
  appState.selectedValue = null;
  appState.selectedCellIndex = null;
  appState.hintCount = 0;
  appState.message = '';
  appState.wrongRowIndices = [];
  appState.wrongColIndices = [];
  appState.smartClear.resetUsed = true;
  if (appState.mode === 'challenge') appState.challengeCombo = 0;
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
  appState.smartClear.hintUsed = true;
  render();
}

// --- Puzzle lifecycle helpers ---

function getCurrentBoardModeKey() {
  return (appState.mode === 'challenge' || appState.mode === 'mission') ? 'standard' : appState.puzzleSize;
}

function applyPuzzleState(puzzleState) {
  appState.boardValues = puzzleState.values;
  appState.fixedCells = Array.from(puzzleState.fixed);
  appState.initialFixedCells = Array.from(puzzleState.fixed);
  appState.selectedValue = null;
  appState.selectedCellIndex = null;
  appState.wrongRowIndices = [];
  appState.wrongColIndices = [];
}

function getChallengeFixedCount(questionNumber) {
  if (questionNumber === 1) return 5;
  if (questionNumber === 2) return 4;
  if (questionNumber === 3) return 3;
  if (questionNumber === 4) return 2;
  if (questionNumber <= 7) return 1;
  return 0;
}

// Combo text is only shown from 2 onward; the wording gets a little more
// excited every couple of steps, but the number itself always keeps counting.
function getComboDisplayText(combo) {
  if (combo < 2) return null;
  if (combo === 2) return '2 COMBO！\n連続ノーミス！';
  if (combo <= 4) return `${combo} COMBO！\nすばらしい集中力！`;
  return `${combo} COMBO！\n鋭い推理が止まらない！`;
}

// Fires right after clearing the given question number, announcing the drop
// in fixed cells the player is about to face on the *next* question. No entry
// for 5/6 (still 1 fixed, same as after Q4) or 8+ (stays at 0 forever after).
function getChallengeMilestoneText(questionNumber) {
  const map = {
    1: 'レベルアップ！\n次は固定マスが4枚！',
    2: 'さらに難しくなるぞ！\n次は固定マスが3枚！',
    3: 'ここから上級！\n次は固定マスが2枚！',
    4: '次は手がかり1枚！\n本格推理に挑戦！',
    7: '完全推理ゾーン突入！\nここからは固定マスなし！',
  };
  return map[questionNumber] || null;
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

// --- Star rating (じっくり + all 4 missions) ---
//
// Every mode's star rating starts from a mode-specific "base tier" (3/2/1,
// see computeMissionBaseTier() for missions; じっくり's base is always 3) and
// then the same two penalties apply everywhere: using a hint costs 1 tier,
// and having gotten a wrong answer and/or pressed reset at any point during
// the attempt costs another 1 tier - no matter how many times either
// happened, each category only ever costs 1 tier, and the result never
// drops below ★☆☆.
const STAR_STRINGS = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };

function computeStarTier(baseTier) {
  const sc = appState.smartClear;
  let tier = baseTier;
  if (sc.hintUsed) tier -= 1;
  if (sc.wrongSubmitted || sc.resetUsed) tier -= 1;
  return Math.max(1, Math.min(3, tier));
}

// The base tier (before the hint/mistake penalties above) for each mission,
// judged purely on how efficiently the puzzle itself was solved.
function computeMissionBaseTier() {
  if (appState.missionType === 'threeLeft') {
    if (appState.missionMoveCount === 3 && appState.resultElapsed <= 10) return 3;
    if (appState.missionMoveCount === 3) return 2;
    return 1;
  }
  if (appState.missionType === 'fixTheSwap') {
    return appState.missionMoveCount === 1 ? 3 : 2;
  }
  if (appState.missionType === 'moveLimit') {
    return appState.missionMoveCount === appState.missionMinSwaps ? 3 : 2;
  }
  // かくされたヒント has no move/time criterion - reaching the result screen
  // at all means it was solved, so it starts at the top tier.
  return 3;
}

// Adds this clear's star tier to the cumulative per-mode total shown on the
// records screen and persists it immediately.
function recordStars(category, tier) {
  appState.records.stars[category] = (appState.records.stars[category] || 0) + tier;
  saveRecords(appState.records);
}

function getLeisureStarCategory() {
  return appState.puzzleSize === 'easy' ? 'leisureEasy' : 'leisureStandard';
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
    if (appState.screen === 'game') updateLiveTimerBadge();
  }, 500);
}

function stopUiTicker() {
  if (appState.uiTickTimer) { clearInterval(appState.uiTickTimer); appState.uiTickTimer = null; }
}

// Patches just the timer badge's text/urgency in place instead of calling
// the full render(). A full render() replaces the entire game screen's
// innerHTML (including every button), which - when done every 250-500ms via
// the tickers below - creates a recurring race window where a tap/click
// straddling a re-render can land on an element that just got swapped out
// from under it, making buttons like 解答する or もどる seem unresponsive.
function getChallengeRemainingSeconds() {
  if (appState.challengeGracePeriodActive) {
    return appState.challengeGraceCountdown ? appState.challengeGraceCountdown.getRemainingSeconds() : 30;
  }
  return appState.challengeCountdown ? appState.challengeCountdown.getRemainingSeconds() : 180;
}

// Beeps once per whole second while the main 3-minute countdown is inside
// its last 10 seconds. Guarded by challengeLastBeepSecond so the 250ms
// interval tick doesn't fire it more than once per second.
function checkChallengeBeep(remainingSeconds) {
  const wholeSecond = Math.ceil(remainingSeconds);
  if (wholeSecond > 0 && wholeSecond < 10 && wholeSecond !== appState.challengeLastBeepSecond) {
    appState.challengeLastBeepSecond = wholeSecond;
    playChallengeBeepSound();
  }
}

function updateLiveTimerBadge() {
  const badge = document.querySelector('.game-card nav.topbar .badge.timer');
  if (!badge) return;
  if (appState.mode === 'challenge') {
    badge.classList.remove('warn', 'danger');
    if (appState.challengeGracePeriodActive) {
      badge.textContent = '最終問題';
      badge.classList.add('danger');
    } else {
      const remaining = getChallengeRemainingSeconds();
      const urgency = remaining <= 10 ? 'danger' : remaining <= 30 ? 'warn' : '';
      badge.textContent = `残り ${formatLiveTime(remaining)}`;
      if (urgency) badge.classList.add(urgency);
    }
  } else if (appState.mode === 'time-attack' || appState.mode === 'three-questions') {
    badge.textContent = formatLiveTime(appState.timer.getElapsedSeconds());
  }
}

function startCountdown(onComplete) {
  // じっくり and ミッションには時計と競う要素がないので、3,2,1 を省き
  // 「START!」のみ表示する。
  const countdownValues = (appState.mode === 'leisure' || appState.mode === 'mission') ? ['START!'] : ['3', '2', '1', 'START!'];
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
  appState.resultBoards = [];
  appState.showResultHistory = false;
  appState.showPuzzleKey = false;
  if (appState.mode === 'three-questions') {
    appState.threeQuestionProgress = 0;
    appState.threeQuestionTimes = [];
    appState.threeQuestionSmartTiers = [];
  }
  appState.resultSmartClear = null;
  resetSmartClearTracking();
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
  appState.challengeAnyMistake = false;
  appState.challengeCombo = 0;
  appState.comboDisplayText = null;
  appState.milestoneDisplayText = null;
  appState.milestoneIsZone = false;
  appState.correctMarkPhase = null;
  appState.challengeFinished = false;
  appState.challengeGracePeriodActive = false;
  appState.challengeGraceCountdown = null;
  appState.challengeLastBeepSecond = null;
  appState.challengeStats = { clearCount: 0, correctCells: 0, noMistakeClears: 0, noMistakeStreak: 0, bestNoMistakeStreak: 0 };
  appState.currentPuzzle = getNextPuzzle('standard');
  applyPuzzleState(createPuzzleState(appState.currentPuzzle, 'standard', getChallengeFixedCount(appState.challengeQuestionNumber)));
  appState.challengeCountdown = new CountdownTimer(180);
  startCountdown(() => {
    appState.screen = 'game';
    appState.challengeCountdown.start();
    appState.challengeTimer = setInterval(() => {
      if (appState.screen !== 'game') return;
      if (!appState.challengeGracePeriodActive) {
        if (appState.challengeCountdown.isFinished()) {
          // Main time's up: the puzzle on screen becomes the final one, with
          // a 20-second grace window to still solve it before time-up.
          appState.challengeGracePeriodActive = true;
          appState.challengeGraceCountdown = new CountdownTimer(30);
          appState.challengeGraceCountdown.start();
          appState.message = '最終問題！';
          render();
        } else {
          checkChallengeBeep(appState.challengeCountdown.getRemainingSeconds());
          updateLiveTimerBadge();
        }
      } else if (appState.challengeGraceCountdown.isFinished()) {
        triggerChallengeTimeUp();
      } else {
        updateLiveTimerBadge();
      }
    }, 250);
  });
}

function startMission(missionType) {
  clearIntervalsOnly();
  appState.mode = 'mission';
  appState.missionType = missionType;
  appState.puzzleSize = 'standard';
  appState.message = '';
  appState.boardShake = false;
  appState.hintCount = 0;
  appState.showPuzzleKey = false;
  appState.missionHintUsed = false;
  appState.missionHintKind = null;
  appState.missionHiddenRowRevealed = false;
  appState.missionMistakeRows = [];
  appState.missionMistakeCols = [];
  appState.missionMoveCount = 0;
  appState.missionMinSwaps = 0;
  appState.missionAllowedMoves = 0;
  appState.missionHiddenPair = null;
  appState.resultMissionText = null;
  resetSmartClearTracking();

  let puzzle = getNextPuzzle('standard');
  let puzzleState;
  if (missionType === 'threeLeft') {
    const setup = createMissionThreeLeftState(puzzle);
    puzzleState = { values: setup.values, fixed: setup.fixed };
  } else if (missionType === 'fixTheSwap') {
    const setup = createMissionFixTheSwapState(puzzle);
    puzzleState = { values: setup.values, fixed: [] };
    appState.missionInitialValues = setup.values.slice();
    appState.missionMistakeRows = setup.mistakeRows;
    appState.missionMistakeCols = setup.mistakeCols;
    appState.missionHintKind = Math.random() < 0.5 ? 'row' : 'col';
  } else if (missionType === 'hiddenHint') {
    // かくされたヒント needs a puzzle whose hiddenHintPairs isn't empty.
    let attempts = 0;
    while ((!puzzle.hiddenHintPairs || puzzle.hiddenHintPairs.length === 0) && attempts < 30) {
      puzzle = getNextPuzzle('standard');
      attempts += 1;
    }
    const pairs = puzzle.hiddenHintPairs || [];
    appState.missionHiddenPair = pairs[Math.floor(Math.random() * pairs.length)] || null;
    puzzleState = { values: Array(9).fill(null), fixed: [] };
  } else {
    const setup = createMissionMoveLimitState(puzzle);
    puzzleState = { values: setup.values, fixed: [] };
    appState.missionInitialValues = setup.values.slice();
    appState.missionMinSwaps = setup.minSwaps;
    appState.missionAllowedMoves = setup.minSwaps + 1;
  }
  appState.currentPuzzle = puzzle;
  applyPuzzleState(puzzleState);
  startCountdown(() => {
    appState.screen = 'game';
    // あと3マス's ★★★ tier needs a (never displayed) elapsed-time check - see
    // computeMissionBaseTier(). No other mission times itself.
    if (missionType === 'threeLeft') {
      appState.timer.reset();
      appState.timer.start();
    }
  });
}

// Each mission with a hint gets exactly one use, spent differently depending
// on the mission: まちがいを直せ reveals only which one row-or-column is
// mismatched (never the exact cells); かくされたヒント reveals the hidden
// row-product's actual number (the hidden column-sum stays hidden); 手数
// リミット locks one already-correctly-placed cell so it can't accidentally
// be swapped away. All of them cost 1 star tier (see computeStarTier()).
function useMissionHint() {
  if (appState.mode !== 'mission' || appState.missionHintUsed) return;
  if (appState.missionType === 'fixTheSwap') {
    appState.missionHintUsed = true;
    appState.smartClear.hintUsed = true;
    if (appState.missionHintKind === 'row') {
      const [r1, r2] = appState.missionMistakeRows;
      appState.message = `${ROW_POSITION_WORDS[r1]}の横一列と${ROW_POSITION_WORDS[r2]}の横一列の積が正しくないよ。`;
    } else {
      const [c1, c2] = appState.missionMistakeCols;
      appState.message = `${COL_POSITION_WORDS[c1]}の縦一列と${COL_POSITION_WORDS[c2]}の縦一列の和が正しくないよ。`;
    }
    render();
  } else if (appState.missionType === 'hiddenHint') {
    appState.missionHintUsed = true;
    appState.smartClear.hintUsed = true;
    appState.missionHiddenRowRevealed = true;
    render();
  } else if (appState.missionType === 'moveLimit') {
    const answer = appState.currentPuzzle.answer;
    let targetIndex = appState.boardValues.findIndex((value, index) => (
      value === answer[index] && !appState.fixedCells.includes(index)
    ));
    if (targetIndex < 0) {
      // Nothing is currently sitting correctly - fall back to a cell that WAS
      // correct in the initial shuffle, swapping its correct number (now
      // sitting wherever the player moved it) back into place for them.
      targetIndex = appState.missionInitialValues.findIndex((value, index) => (
        value === answer[index] && !appState.fixedCells.includes(index)
      ));
      if (targetIndex < 0) return;
      const correctValue = answer[targetIndex];
      const currentIndex = appState.boardValues.indexOf(correctValue);
      if (currentIndex !== targetIndex) {
        const temp = appState.boardValues[targetIndex];
        appState.boardValues[targetIndex] = appState.boardValues[currentIndex];
        appState.boardValues[currentIndex] = temp;
      }
    }
    appState.fixedCells.push(targetIndex);
    appState.missionHintUsed = true;
    appState.smartClear.hintUsed = true;
    render();
  }
}

function submitAnswer() {
  // While the "○" correct-mark is showing, a correct answer has already been
  // recorded and finishCorrectFlow() is queued - mashing 解答する during that
  // window must not re-run onCorrectAnswer() a second (or third...) time.
  if (appState.showCorrectMark) return;
  const boardModeKey = getCurrentBoardModeKey();
  const result = checkSolution(appState.boardValues, appState.currentPuzzle, boardModeKey);
  if (result.valid) {
    onCorrectAnswer();
  } else {
    onWrongAnswer(result);
  }
}

function onCorrectAnswer() {
  appState.lastSmartClearTier = evaluateSmartClear();
  if (appState.mode === 'challenge') {
    appState.challengeCountdown.pause();
    applyChallengeClearStats();
  } else {
    stopTimer();
  }
  showCorrectMark(finishCorrectFlow);
}

// Updates the 3-minute challenge's running stats/combo the instant an answer
// is confirmed correct - i.e. before the 2.5s correct-mark display even
// starts - so the combo/milestone text it computes here is ready in time to
// be shown during that same window (see showCorrectMark()).
function applyChallengeClearStats() {
  const stats = appState.challengeStats;
  const totalCells = appState.boardValues.length;
  stats.clearCount += 1;
  stats.correctCells += totalCells - appState.fixedCells.length;
  if (!appState.challengeMistakeThisPuzzle) {
    stats.noMistakeClears += 1;
    stats.noMistakeStreak += 1;
    stats.bestNoMistakeStreak = Math.max(stats.bestNoMistakeStreak, stats.noMistakeStreak);
    appState.challengeCombo += 1;
  } else {
    stats.noMistakeStreak = 0;
    appState.challengeCombo = 0;
  }
  appState.comboDisplayText = getComboDisplayText(appState.challengeCombo);
  // No "next problem" exists while the grace period's final puzzle is being
  // solved, so there is nothing to announce a milestone about.
  appState.milestoneDisplayText = appState.challengeGracePeriodActive
    ? null
    : getChallengeMilestoneText(appState.challengeQuestionNumber);
  appState.milestoneIsZone = appState.challengeQuestionNumber === 7 && !appState.challengeGracePeriodActive;
}

// The game screen stays put (board and all) while a big "○" pops up over
// it for a beat - no more switching away to a separate reveal screen. For
// the 3-minute challenge, the same window is split in two: the first second
// shows the combo text (if any), the rest shows the milestone text (if any) -
// no extra delay is added, both phases fit inside the existing duration.
function showCorrectMark(onDoneCallback) {
  const baseDurations = { leisure: 1800, 'time-attack': 2500, 'three-questions': 2500, challenge: 2500 };
  const duration = baseDurations[appState.mode] || 1000;
  appState.showCorrectMark = true;
  playCorrectSound();
  if (appState.mode === 'challenge') {
    appState.correctMarkPhase = 'combo';
    if (appState.milestoneIsZone) playChallengeZoneSound();
  }
  render();
  if (appState.mode === 'challenge') {
    setTimeout(() => {
      if (!appState.showCorrectMark) return;
      appState.correctMarkPhase = 'milestone';
      render();
    }, 1000);
  }
  setTimeout(() => {
    appState.showCorrectMark = false;
    appState.correctMarkPhase = null;
    onDoneCallback();
  }, duration);
}

function finishCorrectFlow() {
  if (appState.mode === 'leisure') {
    appState.resultSmartClear = appState.lastSmartClearTier;
    appState.resultStarTier = computeStarTier(3);
    recordStars(getLeisureStarCategory(), appState.resultStarTier);
    playResultChime();
    appState.screen = 'result';
    render();
    return;
  }

  if (appState.mode === 'time-attack') {
    appState.resultSmartClear = appState.lastSmartClearTier;
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
    appState.resultEvaluation = getTimeAttackEvaluation({
      boardType: appState.puzzleSize,
      questionCount: 1,
      totalTimeMs: elapsed * 1000,
    });
    appState.resultBoards = [{
      puzzle: appState.currentPuzzle,
      values: appState.boardValues.slice(),
      fixedCells: appState.fixedCells.slice(),
    }];
    stopUiTicker();
    playResultChime();
    appState.screen = 'result';
    render();
    return;
  }

  if (appState.mode === 'three-questions') {
    appState.threeQuestionTimes.push(appState.timer.getElapsedSeconds());
    appState.threeQuestionSmartTiers.push(appState.lastSmartClearTier);
    appState.resultBoards.push({
      puzzle: appState.currentPuzzle,
      values: appState.boardValues.slice(),
      fixedCells: appState.fixedCells.slice(),
    });
    appState.threeQuestionProgress += 1;
    if (appState.threeQuestionProgress < 3) {
      appState.message = '';
      appState.currentPuzzle = getNextPuzzle();
      applyPuzzleState(createPuzzleState(appState.currentPuzzle, appState.puzzleSize));
      resetSmartClearTracking();
      appState.timer.reset();
      appState.timer.start();
      appState.screen = 'game';
      render();
      return;
    }
    appState.resultSmartClear = getWorstSmartClearTier(appState.threeQuestionSmartTiers);
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
    appState.resultEvaluation = getTimeAttackEvaluation({
      boardType: appState.puzzleSize,
      questionCount: 3,
      totalTimeMs: totalElapsed * 1000,
    });
    stopUiTicker();
    playResultChime();
    appState.screen = 'result';
    render();
    return;
  }

  if (appState.mode === 'challenge') {
    if (appState.challengeGracePeriodActive) {
      // The final problem (granted after the main clock ran out) was solved
      // in time - the run ends here regardless of the grace window.
      finishChallenge();
      return;
    }
    appState.challengeCountdown.resume();
    appState.message = '';
    appState.comboDisplayText = null;
    appState.milestoneDisplayText = null;
    appState.milestoneIsZone = false;
    appState.challengeQuestionNumber += 1;
    appState.challengeMistakeThisPuzzle = false;
    appState.currentPuzzle = getNextPuzzle('standard');
    applyPuzzleState(createPuzzleState(appState.currentPuzzle, 'standard', getChallengeFixedCount(appState.challengeQuestionNumber)));
    appState.screen = 'game';
    render();
    return;
  }

  if (appState.mode === 'mission') {
    if (appState.missionType === 'threeLeft') appState.resultElapsed = appState.timer.getElapsedSeconds();
    appState.resultStarTier = computeStarTier(computeMissionBaseTier());
    recordStars(appState.missionType, appState.resultStarTier);
    appState.resultMissionText = evaluateMissionResult();
    playResultChime();
    appState.screen = 'result';
    render();
  }
}

// Each mission has its own single evaluation line (or none, for a plain
// clear) instead of the 4-tier smart-clear system used elsewhere.
// Star ratings (see computeMissionBaseTier()/computeStarTier()) now carry
// the per-performance evaluation for every mission; the only mission with
// its own extra callout text is あと3マス's speed bonus, independent of the
// move-count that the star tier itself is judged on.
function evaluateMissionResult() {
  const sc = appState.smartClear;
  const firstTryClean = !sc.wrongSubmitted;
  const parts = [];
  if (appState.missionType === 'threeLeft') {
    if (firstTryClean && !sc.hasExtraMove) {
      parts.push('パーフェクト完成！\n残り3枚の場所を一度で見抜いたね！');
    }
    if (appState.resultElapsed <= 10) {
      parts.push('スピード解答！\nあっという間に正解したね！');
    }
  } else if (appState.missionType === 'fixTheSwap') {
    if (firstTryClean && appState.missionMoveCount === 1) {
      parts.push('一発修正！\n入れかわった2枚をすぐに見抜いたね！');
    }
  } else if (appState.missionType === 'hiddenHint') {
    if (firstTryClean) {
      parts.push('完全計算！\n盤面も隠れたヒントも、一度で正しく求められたね！');
    }
  } else if (appState.missionType === 'moveLimit') {
    if (appState.missionMoveCount === appState.missionMinSwaps) {
      parts.push('最短ルート！\nむだのない入れ替えで、見事に完成させたね！');
    } else {
      parts.push('計画的クリア！\n先を考えながら、決められた回数で完成できたね！');
    }
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
}

// この問題のカギ text for the 3 missions that have one (not 手数リミット).
function buildCurrentMissionKey() {
  if (appState.missionType === 'threeLeft') {
    const emptyIndices = Array.from({ length: 9 }, (_, i) => i).filter((i) => !appState.initialFixedCells.includes(i));
    return buildMissionThreeLeftKey(appState.currentPuzzle, emptyIndices);
  }
  if (appState.missionType === 'fixTheSwap') {
    return buildMissionFixTheSwapKey(appState.missionMistakeRows, appState.missionMistakeCols);
  }
  if (appState.missionType === 'hiddenHint') {
    return buildMissionHiddenHintKey(appState.currentPuzzle, appState.missionHiddenPair);
  }
  return null;
}

function onWrongAnswer(result) {
  // まちがいを直せ's paid 1-hint mechanic relies on the player not otherwise
  // being able to see which row/column is off for free - suppress the "×"
  // mismatch highlighting there. Every other mode (かくされたヒント included -
  // it's now just a normal board with 2 clues hidden from view) gets the
  // usual feedback.
  const suppressMismatchHighlight = appState.mode === 'mission' && appState.missionType === 'fixTheSwap';
  appState.message = 'おしい！どこかがちがうよ。\nもう一度見直してみよう！';
  if (appState.mode === 'challenge') {
    appState.challengeMistakeThisPuzzle = true;
    appState.challengeAnyMistake = true;
    appState.challengeCombo = 0;
  }
  appState.smartClear.wrongSubmitted = true;
  playWrongSound();
  appState.boardShake = true;
  setTimeout(() => { appState.boardShake = false; render(); }, 300);

  const puzzle = appState.currentPuzzle;
  if (!suppressMismatchHighlight && result && result.rows && result.cols) {
    appState.wrongRowIndices = result.rows.reduce((acc, value, index) => {
      if (value !== puzzle.rowProducts[index]) acc.push(index);
      return acc;
    }, []);
    appState.wrongColIndices = result.cols.reduce((acc, value, index) => {
      if (value !== puzzle.columnSums[index]) acc.push(index);
      return acc;
    }, []);
  } else {
    appState.wrongRowIndices = [];
    appState.wrongColIndices = [];
  }
  // Mark the mismatched row-product / column-sum numbers with a "×" for
  // about a second, then clear it back off.
  setTimeout(() => {
    appState.wrongRowIndices = [];
    appState.wrongColIndices = [];
    render();
  }, 1000);

  render();
}

// The 20-second grace window on the final problem ran out without a correct
// answer: show "時間切れ" (no board, so no more input can reach it) for a
// beat, then wrap up the run.
function triggerChallengeTimeUp() {
  if (appState.challengeTimer) { clearInterval(appState.challengeTimer); appState.challengeTimer = null; }
  appState.screen = 'time-up';
  render();
  setTimeout(() => { finishChallenge(); }, 1000);
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
    // Not just "every cleared puzzle was clean" (stats.noMistakeClears ===
    // stats.clearCount) - that would ignore a mistake made on the final,
    // never-cleared problem that time ran out on. challengeAnyMistake is set
    // the instant any wrong answer happens, cleared or not.
    allNoMistake: stats.clearCount > 0 && !appState.challengeAnyMistake,
    reachedFixedOne: stats.clearCount >= 5,
    reachedFixedZero: stats.clearCount >= 8,
    isFirstEver,
  };
  playChallengeResultFanfare();
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

function playTone(freq, durationMs, type, peakGain = 0.12) {
  if (!appState.settings.sound || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02);
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

// A short, calm close-out chime for reaching any result screen other than
// 3分チャレンジ's (じっくり/タイムアタック/ミッション) - fewer notes, a slower
// tempo, and a softer volume than playChallengeResultFanfare()'s bigger fanfare.
function playResultChime() {
  const notes = [659.25, 783.99, 1046.5];
  notes.forEach((freq, index) => {
    setTimeout(() => playTone(freq, 220, 'triangle', 0.09), index * 130);
  });
}

// A bigger fanfare for reaching the 3-minute challenge's result screen: a
// longer rising run across two octaves, capped with a sustained chord.
function playChallengeResultFanfare() {
  const run = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  run.forEach((freq, index) => {
    setTimeout(() => playTone(freq, 150, 'triangle'), index * 90);
  });
  const chordDelay = run.length * 90 + 60;
  [1046.5, 1318.51, 1567.98].forEach((freq) => {
    setTimeout(() => playTone(freq, 550, 'triangle'), chordDelay);
  });
}

function playWrongSound() {
  playTone(240, 220, 'sine');
}

// General button/menu press (mode select, back, reset, hint, submit, etc.).
function playClickSound() {
  playTone(520, 70, 'triangle');
}

// Placing or swapping a number into a cell.
function playTapSound() {
  playTone(880, 55, 'triangle');
}

// Selecting a number - either tapping a chip in the panel, or picking an
// already-placed number back up (not swapping it) - pitched distinctly below
// playTapSound() so "selecting" and "placing/swapping" sound different.
function playPanelSelectSound() {
  playTone(440, 55, 'triangle');
}

// Picking a number chip up to start a drag.
function playPickupSound() {
  playTone(480, 55, 'square');
}

// Letting go of a dragged number chip, whether or not it lands on a cell.
function playDropSound() {
  playTone(680, 90, 'square');
}

// ~60% of the standard tone volume - the countdown fires every game start,
// so it's kept quieter than one-off feedback sounds.
const COUNTDOWN_VOLUME = 0.12 * 0.6;

// "3", "2", "1" ticks before a game starts.
function playCountdownTickSound() {
  playTone(500, 110, 'square', COUNTDOWN_VOLUME);
}

// The final "START!" beat of the countdown.
function playCountdownGoSound() {
  playTone(700, 100, 'square', COUNTDOWN_VOLUME);
  setTimeout(() => playTone(1000, 220, 'square', COUNTDOWN_VOLUME), 100);
}

// Once-per-second tick for the final 10 seconds of the 3-minute challenge.
function playChallengeBeepSound() {
  playTone(880, 90, 'square');
}

// A short, distinct sparkle-like flourish for reaching the 3-minute
// challenge's "完全推理ゾーン" (question 8+, no more fixed cells at all).
function playChallengeZoneSound() {
  [880, 1174.66, 1567.98].forEach((freq, index) => {
    setTimeout(() => playTone(freq, 180, 'triangle'), index * 70);
  });
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
  document.body.classList.toggle('bg-numbers-active', appState.screen === 'title' || appState.screen === 'play-style' || appState.screen === 'mission-select');
  document.body.dataset.chipColor = appState.settings.chipColor;
  if ((!appState.puzzlePool || !appState.puzzlePool.easy) && appState.screen === 'game') {
    appEl.innerHTML = '<div class="card"><p>読み込み中...</p></div>';
    return;
  }
  switch (appState.screen) {
    case 'title': renderTitle(); break;
    case 'play-style': renderPlayStyle(); break;
    case 'mission-select': renderMissionSelect(); break;
    case 'howto': renderHowTo(); break;
    case 'tutorial': renderTutorialStep(); break;
    case 'records': renderRecords(); break;
    case 'settings': renderSettings(); break;
    case 'countdown': renderCountdown(); break;
    case 'time-up': renderTimeUp(); break;
    case 'game': renderGame(); break;
    case 'result': renderResult(); break;
    default: renderTitle(); break;
  }
}

function renderTitle() {
  appEl.innerHTML = `
    <div class="card screen-title translucent-card">
      <div class="hero">
        <div class="badge title-badge">思考力をきたえる計算ロジックゲーム</div>
        <h1>かけ×たし+パズル</h1>
        <p class="subtitle">積と和のヒントから表を完成させよう！</p>
      </div>
      <div class="button-grid">
        <button class="primary-btn main-mode-btn" data-action="select-size" data-size="easy">イージー</button>
        <button class="primary-btn main-mode-btn" data-action="select-size" data-size="standard">スタンダード</button>
        <button class="secondary-btn main-mode-btn" data-action="start-challenge">3分チャレンジ</button>
        <button class="secondary-btn main-mode-btn" data-action="show-missions">ミッション</button>
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

function renderMissionSelect() {
  appEl.innerHTML = `
    <div class="card translucent-card">
      <nav class="topbar"><button class="back" data-action="back">← もどる</button><span class="mode-label">ミッションをえらぼう</span></nav>
      <div class="button-grid">
        ${Object.entries(MISSION_INFO).map(([key, info]) => `
        <div class="mode-option">
          <button class="secondary-btn" data-action="start-mission" data-mission="${key}">${info.label}</button>
          <p class="small">${info.description}${key === 'moveLimit' ? '<span class="mission-advanced-tag">【上級者向け】</span>' : ''}</p>
        </div>`).join('')}
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
        ${renderBoardGrid(3, 2, [7, 3, 11], [15, 48], [3, 1, 5, 4, 2, 6].map((value, index) => {
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
      <button class="primary-btn tutorial-cta" data-action="show-tutorial">チュートリアルを見る</button>
      ${renderRulesBody()}
    </div>`;
}

// Step-by-step walkthrough of a single fixed イージー3×2 example, reusing
// renderBoardGrid() so it looks exactly like every other board in the app.
// Always exits back to wherever it was opened from (see getTutorialExitScreen()).
function renderTutorialStep() {
  const step = TUTORIAL_STEPS[appState.tutorialStepIndex];
  const board = TUTORIAL_BOARD;
  const cellsHtml = step.board.map((value, index) => {
    const row = Math.floor(index / board.cols);
    const col = index % board.cols;
    const isHighlighted = step.highlightRows.includes(row) || step.highlightCols.includes(col);
    return `<div class="board-cell ${value !== null ? 'occupied' : ''} ${isHighlighted ? 'tutorial-highlight' : ''}" style="grid-column: ${col + 3}; grid-row: ${row + 3};"><span class="cell-value">${value ?? ''}</span></div>`;
  }).join('');
  const boardHtml = renderBoardGrid(
    board.cols, board.rows, board.columnSums, board.rowProducts, cellsHtml,
    [], [], [], [], step.highlightCols, step.highlightRows,
  );
  const isFirst = appState.tutorialStepIndex === 0;
  const isLast = appState.tutorialStepIndex === TUTORIAL_STEPS.length - 1;
  // formatMessage() escapes the text before converting line breaks, so the
  // game name (plain text, no special characters) can be safely swapped for
  // a styled span afterward without any injection risk.
  const tutorialTextHtml = formatMessage(step.text)
    .replace('かけ×たし+パズル', '<span class="tutorial-brand">かけ×たし+パズル</span>');
  appEl.innerHTML = `
    <div class="card tutorial-screen">
      <nav class="topbar">
        <button class="back" data-action="tutorial-exit">← もどる</button>
        <span class="mode-label">チュートリアル</span>
      </nav>
      <p class="tutorial-progress">${appState.tutorialStepIndex + 1} / ${TUTORIAL_STEPS.length}</p>
      ${boardHtml}
      <p class="tutorial-text">${tutorialTextHtml}</p>
      <div class="row tutorial-nav">
        <button class="ghost-btn" data-action="tutorial-prev" ${isFirst ? 'disabled' : ''}>← 前へ</button>
        <button class="primary-btn" data-action="${isLast ? 'tutorial-exit' : 'tutorial-next'}">${isLast ? 'はじめる' : '次へ →'}</button>
      </div>
      ${appState.tutorialOrigin === 'auto' ? '<button class="ghost-btn small-btn tutorial-skip" data-action="tutorial-exit">スキップ</button>' : ''}
    </div>`;
}

// Reuses the exact same glow classes as the time-attack MAX/SS ranks -
// .rank-tier-max/.rank-tier-high set their own background/box-shadow/shine
// directly (not scoped under .rank-block), so applying them straight to a
// .stat-item card produces the identical colored-and-glowing effect.
function getTimeRecordTier(seconds, maxThreshold, highThreshold) {
  if (seconds === null || seconds === undefined) return '';
  if (seconds <= maxThreshold) return 'rank-tier-max';
  if (seconds <= highThreshold) return 'rank-tier-high';
  return '';
}

function getCountRecordTier(count, maxThreshold, highThreshold) {
  if (count >= maxThreshold) return 'rank-tier-max';
  if (count >= highThreshold) return 'rank-tier-high';
  return '';
}

function renderRecords() {
  const records = appState.records;
  const fmt = (value) => (value === null || value === undefined ? '未記録' : formatResultTime(value));
  const items = [
    renderStatItem('イージー 1問', fmt(records.timeAttack.easy1), getTimeRecordTier(records.timeAttack.easy1, 10, 20)),
    renderStatItem('イージー 3問', fmt(records.timeAttack.easy3), getTimeRecordTier(records.timeAttack.easy3, 30, 60)),
    renderStatItem('スタンダード 1問', fmt(records.timeAttack.standard1), getTimeRecordTier(records.timeAttack.standard1, 40, 80)),
    renderStatItem('スタンダード 3問', fmt(records.timeAttack.standard3), getTimeRecordTier(records.timeAttack.standard3, 120, 240)),
    renderStatItem('3分チャレンジ<br>最高クリア数', `${records.threeMinute.bestClearCount}問`, getCountRecordTier(records.threeMinute.bestClearCount, 8, 6)),
    renderStatItem('3分チャレンジ<br>最高連続ノーミス', `${records.threeMinute.bestStreak}問`, getCountRecordTier(records.threeMinute.bestStreak, 8, 6)),
  ];
  const starIcon = '<span class="star-icon">★</span>';
  const starItems = [
    renderStatItem('じっくりイージー', `${starIcon}${records.stars.leisureEasy}`, getCountRecordTier(records.stars.leisureEasy, 100, 50)),
    renderStatItem('じっくりスタンダード', `${starIcon}${records.stars.leisureStandard}`, getCountRecordTier(records.stars.leisureStandard, 100, 50)),
    renderStatItem('あと3マス', `${starIcon}${records.stars.threeLeft}`, getCountRecordTier(records.stars.threeLeft, 100, 50)),
    renderStatItem('まちがいを直せ', `${starIcon}${records.stars.fixTheSwap}`, getCountRecordTier(records.stars.fixTheSwap, 100, 50)),
    renderStatItem('かくされたヒント', `${starIcon}${records.stars.hiddenHint}`, getCountRecordTier(records.stars.hiddenHint, 100, 50)),
    renderStatItem('手数リミット', `${starIcon}${records.stars.moveLimit}`, getCountRecordTier(records.stars.moveLimit, 100, 50)),
  ];
  appEl.innerHTML = `
    <div class="card">
      <nav class="topbar"><button class="back" data-action="back">← もどる</button><span class="mode-label">記録</span></nav>
      <div class="stat-grid stat-grid-2">
        ${items.join('')}
      </div>
      <p class="small records-section-label">獲得★数</p>
      <div class="stat-grid stat-grid-2">
        ${starItems.join('')}
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
function renderBoardGrid(cols, rows, columnSums, rowProducts, cellsHtml, wrongCols = [], wrongRows = [], hiddenCols = [], hiddenRows = [], highlightCols = [], highlightRows = []) {
  const track = `clamp(48px, 16vw, 64px)`;
  return `
    <div class="board-grid" style="grid-template-columns: max-content max-content repeat(${cols}, ${track}); grid-template-rows: max-content max-content repeat(${rows}, ${track});">
      <div class="group-label col-group-label" style="grid-column: 3 / -1; grid-row: 1;">たての和</div>
      ${columnSums.map((value, i) => `<div class="axis-label col-label ${wrongCols.includes(i) ? 'wrong' : ''} ${hiddenCols.includes(i) ? 'hidden-mystery' : ''} ${highlightCols.includes(i) ? 'highlight' : ''}" style="grid-column: ${i + 3}; grid-row: 2;">${value}</div>`).join('')}
      <div class="group-label row-group-label" style="grid-column: 1; grid-row: 3 / -1;">横の積</div>
      ${rowProducts.map((value, i) => `<div class="axis-label row-label ${wrongRows.includes(i) ? 'wrong' : ''} ${hiddenRows.includes(i) ? 'hidden-mystery' : ''} ${highlightRows.includes(i) ? 'highlight' : ''}" style="grid-column: 2; grid-row: ${i + 3};">${value}</div>`).join('')}
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

function renderTimeUp() {
  appEl.innerHTML = `
    <div class="countdown-overlay">
      <div class="countdown-number time-up">時間切れ</div>
    </div>`;
}

function renderGame() {
  const boardModeKey = getCurrentBoardModeKey();
  const board = getBoardDefinition(boardModeKey);
  const isMission = appState.mode === 'mission';
  const header = isMission ? MISSION_INFO[appState.missionType].label : (MODE_LABELS[appState.mode] || '');
  const isHiddenHintMission = isMission && appState.missionType === 'hiddenHint';
  let currentRows = appState.currentPuzzle.rowProducts;
  let currentCols = appState.currentPuzzle.columnSums;
  let hiddenRowIndices = [];
  let hiddenColIndices = [];
  if (isHiddenHintMission && appState.missionHiddenPair) {
    const pair = appState.missionHiddenPair;
    hiddenColIndices = [pair.colIndex];
    currentCols = currentCols.map((value, index) => (index === pair.colIndex ? '？' : value));
    if (!appState.missionHiddenRowRevealed) {
      hiddenRowIndices = [pair.rowIndex];
      currentRows = currentRows.map((value, index) => (index === pair.rowIndex ? '？' : value));
    }
  }
  const numbers = boardModeKey === 'easy' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const selectedIndex = appState.selectedCellIndex;
  const allFilled = appState.boardValues.every((value) => value !== null);
  const noPanel = isNoPanelMission();

  let timerHtml;
  if (appState.mode === 'challenge') {
    if (appState.challengeGracePeriodActive) {
      timerHtml = '<span class="badge timer danger">最終問題</span>';
    } else {
      const remaining = getChallengeRemainingSeconds();
      const urgency = remaining <= 10 ? 'danger' : remaining <= 30 ? 'warn' : '';
      timerHtml = `<span class="badge timer ${urgency}">残り ${formatLiveTime(remaining)}</span>`;
    }
  } else if (appState.mode === 'time-attack' || appState.mode === 'three-questions') {
    timerHtml = `<span class="badge timer">${formatLiveTime(appState.timer.getElapsedSeconds())}</span>`;
  } else if (isMission && appState.missionType === 'moveLimit') {
    const remainingMoves = Math.max(0, appState.missionAllowedMoves - appState.missionMoveCount);
    timerHtml = `<span class="badge timer">のこり移動回数　${remainingMoves}回</span>`;
  } else {
    timerHtml = '';
  }

  let progressBadge = null;
  if (appState.mode === 'three-questions') {
    progressBadge = `第${appState.threeQuestionProgress + 1}問`;
  } else if (appState.mode === 'challenge') {
    progressBadge = `第${appState.challengeQuestionNumber}問`;
  }

  let hintButton = '';
  if (appState.mode === 'leisure') {
    hintButton = `<button class="ghost-btn" data-action="hint" ${appState.hintCount >= 3 ? 'disabled' : ''}>ヒント${appState.hintCount > 0 ? `(${appState.hintCount}/3)` : ''}</button>`;
  } else if (isMission && (appState.missionType === 'fixTheSwap' || appState.missionType === 'hiddenHint' || appState.missionType === 'moveLimit')) {
    hintButton = `<button class="ghost-btn" data-action="toggle-mission-hint" ${appState.missionHintUsed ? 'disabled' : ''}>ヒント${appState.missionHintUsed ? '(使用済み)' : ''}</button>`;
  }

  const zoneFlash = appState.showCorrectMark && appState.correctMarkPhase === 'milestone' && appState.milestoneIsZone;

  appEl.innerHTML = `
    <div class="card game-card ${zoneFlash ? 'zone-flash' : ''}">
      <nav class="topbar">
        <button class="back" data-action="back">← もどる</button>
        ${progressBadge ? `<span class="badge">${progressBadge}</span>` : ''}
        ${timerHtml}
      </nav>
      ${renderBoardGrid(board.cols, board.rows, currentCols, currentRows, appState.boardValues.map((value, index) => {
        const row = Math.floor(index / board.cols);
        const col = index % board.cols;
        const fixed = appState.fixedCells.includes(index);
        const selected = index === selectedIndex;
        return `<button class="board-cell ${fixed ? 'fixed' : ''} ${value !== null ? 'occupied' : ''} ${selected ? 'selected' : ''} ${appState.boardShake ? 'shake' : ''}" style="grid-column: ${col + 3}; grid-row: ${row + 3};" data-action="select-cell" data-index="${index}">
          <span class="cell-value">${value ?? ''}</span>
        </button>`;
      }).join(''), appState.wrongColIndices, appState.wrongRowIndices, hiddenColIndices, hiddenRowIndices)}
      ${noPanel ? '' : `
      <div class="number-panel ${boardModeKey === 'easy' ? 'number-panel-grid3' : 'number-panel-grid5'}">
        ${numbers.map((number) => {
          const used = appState.boardValues.includes(number);
          return `<button class="number-chip ${used ? 'used' : ''} ${appState.selectedValue === number ? 'selected' : ''}" data-action="number" data-value="${number}">${number}</button>`;
        }).join('')}
      </div>`}
      <div class="controls">
        <button class="ghost-btn" data-action="reset">リセット</button>
        ${hintButton}
        <button class="primary-btn" data-action="submit" ${allFilled && !appState.showCorrectMark ? '' : 'disabled'}>解答する</button>
      </div>
      <p class="mode-label">${getBoardSize(boardModeKey) === '3x2' ? 'イージー 3×2' : 'スタンダード 3×3'}　${header}</p>
      ${isMission ? `<p class="small mission-guidance">${MISSION_INFO[appState.missionType].description}</p>` : ''}
      <div class="message">${formatMessage(appState.message)}</div>
      ${renderCorrectMarkOverlay()}
    </div>`;
}

// Beyond the "○" itself, the 3-minute challenge overlays a combo readout
// (first second) then a milestone readout (rest of the window) - see
// showCorrectMark() for the phase timing. Neither ever shows for other modes.
function renderCorrectMarkOverlay() {
  if (!appState.showCorrectMark) return '';
  let extra = '';
  if (appState.mode === 'challenge') {
    if (appState.correctMarkPhase === 'combo' && appState.comboDisplayText) {
      extra = `<div class="combo-effect">${formatMessage(appState.comboDisplayText)}</div>`;
    } else if (appState.correctMarkPhase === 'milestone' && appState.milestoneDisplayText) {
      extra = `<div class="milestone-effect ${appState.milestoneIsZone ? 'milestone-zone' : ''}">${formatMessage(appState.milestoneDisplayText)}</div>`;
    }
  }
  return `<div class="correct-mark-overlay"><div class="correct-mark">○</div>${extra}</div>`;
}

const RANK_TIER_CLASS = {
  MAX: 'rank-tier-max',
  SS: 'rank-tier-high',
  S: 'rank-tier-high',
  A: 'rank-tier-mid',
  B: 'rank-tier-mid',
  C: 'rank-tier-calm',
  D: 'rank-tier-calm',
  E: 'rank-tier-calm',
  F: 'rank-tier-calm',
};

// A single labelled stat tile used across the time-attack result screens.
function renderStatItem(label, value, extraClass = '') {
  return `<div class="stat-item ${extraClass}"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
}

// Shared by the 1問 and 3問 time-attack result screens so the rank/title/
// comment markup isn't duplicated between them.
function renderEvaluationBlock(evaluation) {
  if (!evaluation) return '';
  const tierClass = RANK_TIER_CLASS[evaluation.rank] || '';
  return `
    <div class="rank-block ${tierClass}">
      <p class="rank-badge">ランク ${evaluation.rank}</p>
      <p class="rank-title">${evaluation.title}</p>
      <p class="rank-comment">${evaluation.comment}</p>
    </div>`;
}

// Shown for じっくり and both time-attack results (not 3分チャレンジ or missions
// with their own dedicated evaluation), just below the record-update badge.
function renderSmartClearBlock(tierKey, isTriple) {
  if (!tierKey) return '';
  const info = SMART_CLEAR_INFO[tierKey];
  const text = isTriple ? info.tripleComment : info.comment;
  return `<div class="smart-clear-block"><p class="smart-clear-comment">${formatMessage(text)}</p></div>`;
}

// Collapsible, closed-by-default explanation of the puzzle's solving
// approach. Only shown for じっくり and select missions - never for any timed
// mode, since a "cheat sheet" wouldn't make sense once a clock is involved.
function renderPuzzleKeyBlock(keyText) {
  if (!keyText) return '';
  return `
    <div class="puzzle-key-block">
      <button class="ghost-btn small-btn" data-action="toggle-puzzle-key">${appState.showPuzzleKey ? 'この問題のカギを閉じる' : 'この問題のカギを見る'}</button>
      ${appState.showPuzzleKey ? `<p class="puzzle-key-text">${formatMessage(keyText)}</p>` : ''}
    </div>`;
}

// Shows the completed board(s) for the time-attack/three-questions result
// screen once "りれき" is toggled on - one diagram for 1問, three (each
// labelled) for 3問, reusing the same board-grid renderer as everywhere else.
function renderResultBoardHistory() {
  if (!appState.showResultHistory || appState.resultBoards.length === 0) return '';
  const board = getBoardDefinition(appState.puzzleSize);
  return appState.resultBoards.map((entry, index) => {
    const label = appState.resultBoards.length > 1 ? `<p class="small result-board-label">第${index + 1}問</p>` : '';
    const grid = renderBoardGrid(
      board.cols,
      board.rows,
      entry.puzzle.columnSums,
      entry.puzzle.rowProducts,
      entry.values.map((value, i) => {
        const row = Math.floor(i / board.cols);
        const col = i % board.cols;
        const fixed = entry.fixedCells.includes(i);
        return `<div class="board-cell occupied ${fixed ? 'fixed' : ''}" style="grid-column: ${col + 3}; grid-row: ${row + 3};"><span class="cell-value">${value}</span></div>`;
      }).join(''),
    );
    return `<div class="result-board-entry">${label}${grid}</div>`;
  }).join('');
}

function renderResult() {
  let inner = '';
  if (appState.mode === 'leisure') {
    const boardModeKey = getCurrentBoardModeKey();
    const board = getBoardDefinition(boardModeKey);
    const completedBoardHtml = renderBoardGrid(
      board.cols,
      board.rows,
      appState.currentPuzzle.columnSums,
      appState.currentPuzzle.rowProducts,
      appState.boardValues.map((value, index) => {
        const row = Math.floor(index / board.cols);
        const col = index % board.cols;
        const fixed = appState.fixedCells.includes(index);
        return `<div class="board-cell occupied ${fixed ? 'fixed' : ''}" style="grid-column: ${col + 3}; grid-row: ${row + 3};"><span class="cell-value">${value}</span></div>`;
      }).join(''),
    );
    const stars = STAR_STRINGS[appState.resultStarTier];
    inner = `
      <div class="result-title-row">
        <h2>正解！</h2>
        <p class="star-rating ${stars === '★★★' ? 'star-rating-perfect' : ''}">${stars}</p>
      </div>
      ${appState.resultSmartClear ? '' : '<p class="small">よく考えたね！</p>'}
      ${renderSmartClearBlock(appState.resultSmartClear, false)}
      ${renderPuzzleKeyBlock(buildPuzzleKey(appState.currentPuzzle, boardModeKey))}
      <div class="row">
        <button class="primary-btn" data-action="next-puzzle">もう1問</button>
        <button class="ghost-btn" data-action="title-again">タイトルにもどる</button>
      </div>
      ${completedBoardHtml}`;
  } else if (appState.mode === 'time-attack') {
    const best = appState.resultPreviousBest;
    inner = `
      <h2>1問クリア！</h2>
      ${renderEvaluationBlock(appState.resultEvaluation)}
      <div class="stat-grid stat-grid-2">
        ${renderStatItem('クリアタイム', formatResultTime(appState.resultElapsed))}
        ${renderStatItem('ベストタイム', best === null || best === undefined ? '初挑戦' : formatResultTime(best))}
      </div>
      ${appState.isNewRecord ? '<p class="record-badge">自己ベスト更新！</p>' : ''}
      ${renderSmartClearBlock(appState.resultSmartClear, false)}
      <div class="row">
        <button class="primary-btn" data-action="play-again">もう1回</button>
        <button class="ghost-btn" data-action="title-again">タイトルへ</button>
        <button class="ghost-btn" data-action="toggle-result-history">りれき</button>
      </div>
      ${renderResultBoardHistory()}`;
  } else if (appState.mode === 'three-questions') {
    const best = appState.resultPreviousBest;
    const averageSeconds = appState.resultElapsed / 3;
    const questionItems = appState.threeQuestionTimes.map((time, index) => renderStatItem(`第${index + 1}問`, formatResultTime(time))).join('');
    inner = `
      <h2>3問クリア！</h2>
      ${renderEvaluationBlock(appState.resultEvaluation)}
      <div class="stat-grid stat-grid-3">
        ${renderStatItem('1問平均', formatResultTime(averageSeconds))}
        ${renderStatItem('合計タイム', formatResultTime(appState.resultElapsed), 'stat-item-emphasis')}
        ${renderStatItem('ベストタイム', best === null || best === undefined ? '初挑戦' : formatResultTime(best))}
        ${questionItems}
      </div>
      ${appState.isNewRecord ? '<p class="record-badge">自己ベスト更新！</p>' : ''}
      ${renderSmartClearBlock(appState.resultSmartClear, true)}
      <div class="row">
        <button class="primary-btn" data-action="play-again">もう1回</button>
        <button class="ghost-btn" data-action="title-again">タイトルへ</button>
        <button class="ghost-btn" data-action="toggle-result-history">りれき</button>
      </div>
      ${renderResultBoardHistory()}`;
  } else if (appState.mode === 'challenge') {
    const stats = appState.challengeStats;
    const info = appState.resultChallenge;
    const extraMessages = [];
    if (info.isNewRecord) extraMessages.push('<p class="record-badge">自己ベスト更新！<br>前の自分を超えたぞ！</p>');
    if (info.allNoMistake) extraMessages.push('<p class="record-badge">パーフェクト思考！<br>一度も間違えずに答えを導けたね！</p>');
    if (info.reachedFixedZero) {
      extraMessages.push('<p class="record-badge">完全推理成功！<br>積と和だけを手がかりに、すべての数字を見抜いた！</p>');
    } else if (info.reachedFixedOne) {
      extraMessages.push('<p class="record-badge">固定マス1個で正解！<br>少ない手がかりから答えを完成させた！</p>');
    }
    if (info.isFirstEver) extraMessages.push('<p class="record-badge">初チャレンジ完了！<br>まずは最後まで挑戦したことがすばらしい！</p>');
    let challengeTierClass = '';
    if (stats.clearCount >= 8) challengeTierClass = 'rank-tier-max';
    else if (stats.clearCount >= 6) challengeTierClass = 'rank-tier-high';
    // The final problem's answer, shown regardless of whether it was ever
    // cleared - if time ran out on it, this is the only way to check what
    // it should have been. appState.currentPuzzle still points at it since
    // it's only ever reassigned when moving on to a new puzzle after a clear.
    const finalBoard = getBoardDefinition('standard');
    const finalAnswerBoardHtml = renderBoardGrid(
      finalBoard.cols,
      finalBoard.rows,
      appState.currentPuzzle.columnSums,
      appState.currentPuzzle.rowProducts,
      appState.currentPuzzle.answer.map((value, index) => {
        const row = Math.floor(index / finalBoard.cols);
        const col = index % finalBoard.cols;
        return `<div class="board-cell occupied" style="grid-column: ${col + 3}; grid-row: ${row + 3};"><span class="cell-value">${value}</span></div>`;
      }).join(''),
    );
    inner = `
      <h2>3分チャレンジ終了！</h2>
      <div class="rank-block ${challengeTierClass}">
        <p class="rank-title">${info.titleInfo.title}</p>
        <p class="rank-comment">${info.titleInfo.text}</p>
      </div>
      <div class="stat-grid stat-grid-2">
        ${renderStatItem('クリア数', `${stats.clearCount}問`)}
        ${renderStatItem('連続ノーミス', `${stats.bestNoMistakeStreak}問`)}
      </div>
      ${extraMessages.join('')}
      <div class="row">
        <button class="primary-btn" data-action="play-again">もう1回</button>
        <button class="ghost-btn" data-action="title-again">タイトルへ</button>
      </div>
      <p class="small result-board-label">最終問題の答え</p>
      ${finalAnswerBoardHtml}`;
  } else if (appState.mode === 'mission') {
    const board = getBoardDefinition('standard');
    const pair = appState.missionType === 'hiddenHint' ? appState.missionHiddenPair : null;
    const completedBoardHtml = renderBoardGrid(
      board.cols,
      board.rows,
      appState.currentPuzzle.columnSums,
      appState.currentPuzzle.rowProducts,
      appState.boardValues.map((value, index) => {
        const row = Math.floor(index / board.cols);
        const col = index % board.cols;
        return `<div class="board-cell occupied" style="grid-column: ${col + 3}; grid-row: ${row + 3};"><span class="cell-value">${value}</span></div>`;
      }).join(''),
      [], [],
      pair ? [pair.colIndex] : [],
      pair ? [pair.rowIndex] : [],
    );
    const missionStars = STAR_STRINGS[appState.resultStarTier];
    inner = `
      <h2>${MISSION_INFO[appState.missionType].label}　クリア！</h2>
      <p class="star-rating ${missionStars === '★★★' ? 'star-rating-perfect' : ''}">${missionStars}</p>
      ${appState.resultMissionText ? `<div class="smart-clear-block"><p class="smart-clear-comment">${formatMessage(appState.resultMissionText)}</p></div>` : ''}
      ${renderPuzzleKeyBlock(buildCurrentMissionKey())}
      <div class="row">
        <button class="primary-btn" data-action="play-again">同じミッションをもう1問</button>
        <button class="ghost-btn" data-action="show-missions">ミッション選択へ</button>
        <button class="ghost-btn" data-action="title-again">タイトルへ</button>
      </div>
      ${completedBoardHtml}`;
  }
  appEl.innerHTML = `<div class="card result-card">${inner}</div>`;
}

window.addEventListener('load', init);
