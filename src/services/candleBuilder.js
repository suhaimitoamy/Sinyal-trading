// ============================================================================
// candleBuilder.js — Builds M1 (1-minute) candles from real-time tick data
// ============================================================================

/**
 * CandleBuilder accumulates ticks into 1-minute OHLC candles.
 *
 * Rules:
 *  • Uses the feed timestamp (unix seconds) — never Date.now().
 *  • Once a candle is closed (pushed to this.candles) it is NEVER modified.
 *  • `currentCandle` is the in-progress bar; it may be updated on every tick.
 */
export class CandleBuilder {
  constructor() {
    /** @type {Array<{time:number, open:number, high:number, low:number, close:number, tickCount:number}>} */
    this.candles = [];

    /** @type {{time:number, open:number, high:number, low:number, close:number, tickCount:number}|null} */
    this.currentCandle = null;

    /** @type {Array<function>} */
    this.updateCallbacks = [];

    /** @type {Array<function>} */
    this.closeCallbacks = [];
  }

  // -----------------------------------------------------------------------
  // Core processing
  // -----------------------------------------------------------------------

  /**
   * Processes a single tick and either creates a new M1 candle or updates the
   * current one.
   *
   * @param {{price: number, timestamp: number}} tick
   *   `price`     — current market price
   *   `timestamp` — unix seconds from the data feed
   */
  processTick(tick) {
    const { price, timestamp } = tick;
    if (!Number.isFinite(price) || !Number.isFinite(timestamp)) return;

    // Floor to the start of the minute (UTC)
    const minuteTs = Math.floor(timestamp / 60) * 60;

    // --- New candle required? ---
    if (this.currentCandle === null || minuteTs > this.currentCandle.time) {
      // Close out the previous candle (if any)
      if (this.currentCandle !== null) {
        // Push an immutable copy into the completed array
        this.candles.push({ ...this.currentCandle });
        this._emitClose({ ...this.currentCandle });
      }

      // Open a brand-new candle
      this.currentCandle = {
        time: minuteTs,
        open: price,
        high: price,
        low: price,
        close: price,
        tickCount: 1,
      };
    } else {
      // --- Same minute — update in place ---
      this.currentCandle.high = Math.max(this.currentCandle.high, price);
      this.currentCandle.low = Math.min(this.currentCandle.low, price);
      this.currentCandle.close = price;
      this.currentCandle.tickCount++;
    }

    // Notify listeners of the update (always)
    this._emitUpdate({ ...this.currentCandle });
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /**
   * Returns an array of all *closed* candles (copies).
   * @returns {Array}
   */
  getCandles() {
    return this.candles.map((c) => ({ ...c }));
  }

  /**
   * Returns a copy of the currently-forming candle, or null.
   * @returns {object|null}
   */
  getCurrentCandle() {
    return this.currentCandle ? { ...this.currentCandle } : null;
  }

  /**
   * Returns closed candles + the current candle (if any).
   * @returns {Array}
   */
  getAllCandles() {
    const all = this.candles.map((c) => ({ ...c }));
    if (this.currentCandle) {
      all.push({ ...this.currentCandle });
    }
    return all;
  }

  // -----------------------------------------------------------------------
  // State management
  // -----------------------------------------------------------------------

  /**
   * Replaces the internal closed-candle array (used when loading from storage).
   * @param {Array} candles
   */
  setCandles(candles) {
    this.candles = candles.map((c) => ({ ...c }));
  }

  /**
   * Trims the closed-candle array to keep only the last `maxCount` entries.
   * @param {number} maxCount
   */
  trimCandles(maxCount) {
    if (this.candles.length > maxCount) {
      this.candles = this.candles.slice(-maxCount);
    }
  }

  // -----------------------------------------------------------------------
  // Event registration
  // -----------------------------------------------------------------------

  /**
   * Called on every tick with the updated current candle.
   * @param {function} cb
   */
  onCandleUpdate(cb) {
    this.updateCallbacks.push(cb);
  }

  /**
   * Called when a candle closes (new minute starts).
   * @param {function} cb
   */
  onCandleClose(cb) {
    this.closeCallbacks.push(cb);
  }

  // -----------------------------------------------------------------------
  // Internal emitters
  // -----------------------------------------------------------------------

  /** @private */
  _emitUpdate(candle) {
    for (const cb of this.updateCallbacks) {
      try {
        cb(candle);
      } catch (err) {
        console.error('[CandleBuilder] updateCallback error:', err);
      }
    }
  }

  /** @private */
  _emitClose(candle) {
    for (const cb of this.closeCallbacks) {
      try {
        cb(candle);
      } catch (err) {
        console.error('[CandleBuilder] closeCallback error:', err);
      }
    }
  }
}
