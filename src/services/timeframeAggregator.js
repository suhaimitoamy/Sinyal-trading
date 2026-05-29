// ============================================================================
// timeframeAggregator.js — Aggregates M1 candles into M5, M15, H1
// ============================================================================

/**
 * Period durations in seconds.
 */
const TIMEFRAMES = {
  m5: 300,   // 5 minutes
  m15: 900,  // 15 minutes
  h1: 3600,  // 1 hour
};

const TF_KEYS = /** @type {const} */ (['m5', 'm15', 'h1']);

export class TimeframeAggregator {
  constructor() {
    /** Completed candles per timeframe. */
    this.candles = { m5: [], m15: [], h1: [] };

    /** Currently-forming candle per timeframe (or null). */
    this.currentCandle = { m5: null, m15: null, h1: null };

    /** Callbacks fired whenever the in-progress candle is updated. */
    this.updateCallbacks = { m5: [], m15: [], h1: [] };

    /** Callbacks fired when a higher-TF candle closes. */
    this.closeCallbacks = { m5: [], m15: [], h1: [] };
  }

  // -----------------------------------------------------------------------
  // Core processing
  // -----------------------------------------------------------------------

  /**
   * Feed an M1 candle into all higher timeframes.
   *
   * @param {{time:number, open:number, high:number, low:number, close:number, tickCount?:number}} m1Candle
   * @param {boolean} isClosed — true when the M1 candle is finalized
   */
  processM1Candle(m1Candle, isClosed) {
    for (const tf of TF_KEYS) {
      const period = TIMEFRAMES[tf];

      // Floor the M1 candle's timestamp to the higher-TF boundary
      const tfTs = Math.floor(m1Candle.time / period) * period;

      const cur = this.currentCandle[tf];

      if (cur === null || tfTs > cur.time) {
        // --- New higher-TF period ---
        if (cur !== null) {
          // Close out the previous higher-TF candle
          this.candles[tf].push({ ...cur });
          this._emitClose(tf, { ...cur });
        }

        // Start a new higher-TF candle from this M1 candle
        this.currentCandle[tf] = {
          time: tfTs,
          open: m1Candle.open,
          high: m1Candle.high,
          low: m1Candle.low,
          close: m1Candle.close,
          tickCount: m1Candle.tickCount || 1,
        };
      } else {
        // --- Same higher-TF period — merge ---
        cur.high = Math.max(cur.high, m1Candle.high);
        cur.low = Math.min(cur.low, m1Candle.low);
        cur.close = m1Candle.close;
        cur.tickCount += m1Candle.tickCount || 1;
      }

      // Notify update listeners
      this._emitUpdate(tf, { ...this.currentCandle[tf] });
    }
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /**
   * Returns completed candles + current candle (if any) for a timeframe.
   * @param {'m5'|'m15'|'h1'} tf
   * @returns {Array}
   */
  getCandles(tf) {
    const all = this.candles[tf].map((c) => ({ ...c }));
    if (this.currentCandle[tf]) {
      all.push({ ...this.currentCandle[tf] });
    }
    return all;
  }

  /**
   * Replaces the closed-candle array for a timeframe (used when loading from storage).
   * @param {'m5'|'m15'|'h1'} tf
   * @param {Array} candles
   */
  setCandles(tf, candles) {
    this.candles[tf] = candles.map((c) => ({ ...c }));
  }

  // -----------------------------------------------------------------------
  // Event registration
  // -----------------------------------------------------------------------

  /**
   * Register a callback for in-progress candle updates on a timeframe.
   * @param {'m5'|'m15'|'h1'} tf
   * @param {function} cb
   */
  onCandleUpdate(tf, cb) {
    this.updateCallbacks[tf].push(cb);
  }

  /**
   * Register a callback for candle-close events on a timeframe.
   * @param {'m5'|'m15'|'h1'} tf
   * @param {function} cb
   */
  onCandleClose(tf, cb) {
    this.closeCallbacks[tf].push(cb);
  }

  // -----------------------------------------------------------------------
  // Internal emitters
  // -----------------------------------------------------------------------

  /** @private */
  _emitUpdate(tf, candle) {
    for (const cb of this.updateCallbacks[tf]) {
      try {
        cb(candle);
      } catch (err) {
        console.error(`[TimeframeAggregator] updateCallback(${tf}) error:`, err);
      }
    }
  }

  /** @private */
  _emitClose(tf, candle) {
    for (const cb of this.closeCallbacks[tf]) {
      try {
        cb(candle);
      } catch (err) {
        console.error(`[TimeframeAggregator] closeCallback(${tf}) error:`, err);
      }
    }
  }
}
