const STORAGE_KEY = 'kake-tashi-puzzle-records-v1';
const SETTINGS_KEY = 'kake-tashi-puzzle-settings-v1';

function defaultRecords() {
  return {
    version: 1,
    timeAttack: { easy1: null, easy3: null, standard1: null, standard3: null },
    threeMinute: { bestClearCount: 0, bestCorrectCells: 0, bestStreak: 0, playCount: 0 },
    stars: { leisureEasy: 0, leisureStandard: 0, threeLeft: 0, fixTheSwap: 0, hiddenHint: 0, moveLimit: 0 },
  };
}

function readRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRecords();
    const parsed = JSON.parse(raw);
    const fallback = defaultRecords();
    return {
      version: 1,
      timeAttack: { ...fallback.timeAttack, ...(parsed.timeAttack || {}) },
      threeMinute: { ...fallback.threeMinute, ...(parsed.threeMinute || {}) },
      stars: { ...fallback.stars, ...(parsed.stars || {}) },
    };
  } catch (error) {
    return defaultRecords();
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function resetRecords() {
  const empty = defaultRecords();
  saveRecords(empty);
  return empty;
}

function defaultSettings() {
  return { sound: true, chipColor: 'orange' };
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch (error) {
    return defaultSettings();
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
