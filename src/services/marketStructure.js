export class MarketStructureDetector {
  constructor() {
    this.trend = 'undefined';
    this.history = [];
    this.lastSwingHigh = null;
    this.lastSwingLow = null;
    this.processedIds = new Set();
  }

  detect(candle, confirmedSwings) {
    const events = [];

    const swingHighs = confirmedSwings.filter(s => s.type === 'high');
    const swingLows = confirmedSwings.filter(s => s.type === 'low');
    const latestSH = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;
    const latestSL = swingLows.length > 0 ? swingLows[swingLows.length - 1] : null;

    if (!latestSH || !latestSL) return events;

    this.lastSwingHigh = latestSH;
    this.lastSwingLow = latestSL;

    const breakHighId = `break_high_${latestSH.time}_${candle.time}`;
    const breakLowId = `break_low_${latestSL.time}_${candle.time}`;

    if (candle.close > latestSH.price && !this.processedIds.has(breakHighId)) {
      this.processedIds.add(breakHighId);
      if (this.trend === 'bearish' || this.trend === 'undefined') {
        events.push({
          id: breakHighId,
          type: 'choch',
          direction: 'bullish',
          price: candle.close,
          level: latestSH.price,
          time: candle.time,
          swingTime: latestSH.time,
        });
        this.trend = 'bullish';
      } else {
        events.push({
          id: breakHighId,
          type: 'bos',
          direction: 'bullish',
          price: candle.close,
          level: latestSH.price,
          time: candle.time,
          swingTime: latestSH.time,
        });
      }
      this.history.push(events[events.length - 1]);
    }

    if (candle.close < latestSL.price && !this.processedIds.has(breakLowId)) {
      this.processedIds.add(breakLowId);
      if (this.trend === 'bullish' || this.trend === 'undefined') {
        events.push({
          id: breakLowId,
          type: 'choch',
          direction: 'bearish',
          price: candle.close,
          level: latestSL.price,
          time: candle.time,
          swingTime: latestSL.time,
        });
        this.trend = 'bearish';
      } else {
        events.push({
          id: breakLowId,
          type: 'bos',
          direction: 'bearish',
          price: candle.close,
          level: latestSL.price,
          time: candle.time,
          swingTime: latestSL.time,
        });
      }
      this.history.push(events[events.length - 1]);
    }

    return events;
  }

  getTrend() { return this.trend; }
  getHistory() { return [...this.history]; }
  setHistory(h) { this.history = [...h]; }
  setTrend(t) { this.trend = t; }
}
