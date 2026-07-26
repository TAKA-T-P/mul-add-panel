// Elapsed-time stopwatch used for leisure / time-attack / three-question modes.
// Always derives elapsed time from performance.now() diffs (never a naive
// setInterval counter) so drift and background-tab throttling do not skew it.
class PuzzleTimer {
  constructor() {
    this.startedAt = null;
    this.elapsed = 0;
    this.running = false;
  }

  start() {
    this.startedAt = performance.now() - this.elapsed;
    this.running = true;
  }

  stop() {
    if (!this.running) return;
    this.elapsed = performance.now() - this.startedAt;
    this.running = false;
  }

  reset() {
    this.startedAt = null;
    this.elapsed = 0;
    this.running = false;
  }

  getElapsedSeconds() {
    if (!this.running) return this.elapsed / 1000;
    return (performance.now() - this.startedAt) / 1000;
  }
}

// Countdown used by the 3-minute challenge. Also anchored to performance.now()
// so the remaining time stays correct even if the interval tick is delayed
// (e.g. a backgrounded tab), instead of just subtracting 1 each tick.
class CountdownTimer {
  constructor(totalSeconds) {
    this.totalSeconds = totalSeconds;
    this.startedAt = null;
    this.pausedAt = null;
    this.pausedDuration = 0;
    this.running = false;
  }

  start() {
    this.startedAt = performance.now();
    this.pausedAt = null;
    this.pausedDuration = 0;
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  // Freezes the remaining time (e.g. while a correct-answer animation plays)
  // so that real time spent there isn't silently deducted from the clock.
  pause() {
    if (!this.running || this.pausedAt !== null) return;
    this.pausedAt = performance.now();
  }

  resume() {
    if (this.pausedAt === null) return;
    this.pausedDuration += performance.now() - this.pausedAt;
    this.pausedAt = null;
  }

  getRemainingSeconds() {
    if (!this.startedAt) return this.totalSeconds;
    const now = this.pausedAt !== null ? this.pausedAt : performance.now();
    const elapsed = (now - this.startedAt - this.pausedDuration) / 1000;
    return Math.max(0, this.totalSeconds - elapsed);
  }

  isFinished() {
    return this.getRemainingSeconds() <= 0;
  }
}
