export class SweepDetector {
  constructor() {
    this.history = [];
    this.sweptLevelIds = new Set();
  }

  detect(candle, levels, confirmedSwings) {
    const events = [];
    const checkLevels = [];
    
    if (levels.asiaHigh) checkLevels.push({ name: 'Asia High', price: levels.asiaHigh, type: 'high' });
    if (levels.asiaLow) checkLevels.push({ name: 'Asia Low', price: levels.asiaLow, type: 'low' });
    if (levels.londonHigh) checkLevels.push({ name: 'London High', price: levels.londonHigh, type: 'high' });
    if (levels.londonLow) checkLevels.push({ name: 'London Low', price: levels.londonLow, type: 'low' });
    if (levels.prevDayHigh) checkLevels.push({ name: 'PDH', price: levels.prevDayHigh, type: 'high' });
    if (levels.prevDayLow) checkLevels.push({ name: 'PDL', price: levels.prevDayLow, type: 'low' });

    const recentSwingHighs = confirmedSwings.filter(s => s.type === 'high').slice(-5);
    const recentSwingLows = confirmedSwings.filter(s => s.type === 'low').slice(-5);
    recentSwingHighs.forEach(s => checkLevels.push({ name: 'Swing High', price: s.price, type: 'high', id: `sh_${s.time}` }));
    recentSwingLows.forEach(s => checkLevels.push({ name: 'Swing Low', price: s.price, type: 'low', id: `sl_${s.time}` }));

    for (const level of checkLevels) {
      const levelId = level.id || `${level.name}_${level.price}`;
      if (this.sweptLevelIds.has(levelId)) continue;

      if (level.type === 'high') {
        if (candle.high > level.price && candle.close < level.price) {
          const event = {
            id: `sweep_${levelId}_${candle.time}`,
            type: 'high_sweep',
            levelName: level.name,
            levelPrice: level.price,
            sweepPrice: candle.high,
            closePrice: candle.close,
            time: candle.time,
          };
          events.push(event);
          this.history.push(event);
          this.sweptLevelIds.add(levelId);
        }
      } else {
        if (candle.low < level.price && candle.close > level.price) {
          const event = {
            id: `sweep_${levelId}_${candle.time}`,
            type: 'low_sweep',
            levelName: level.name,
            levelPrice: level.price,
            sweepPrice: candle.low,
            closePrice: candle.close,
            time: candle.time,
          };
          events.push(event);
          this.history.push(event);
          this.sweptLevelIds.add(levelId);
        }
      }
    }

    return events;
  }

  getHistory() { return [...this.history]; }
  setHistory(h) { this.history = [...h]; }
  resetSession() { this.sweptLevelIds.clear(); }
}
