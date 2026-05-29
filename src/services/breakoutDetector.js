export class BreakoutDetector {
  constructor() {
    this.history = [];
    this.brokenLevelIds = new Set();
  }

  detect(candle, levels, confirmedSwings) {
    const events = [];
    const checkLevels = [];
    
    if (levels.asiaHigh) checkLevels.push({ name: 'Asia High', price: levels.asiaHigh, type: 'resistance' });
    if (levels.asiaLow) checkLevels.push({ name: 'Asia Low', price: levels.asiaLow, type: 'support' });
    if (levels.londonHigh) checkLevels.push({ name: 'London High', price: levels.londonHigh, type: 'resistance' });
    if (levels.londonLow) checkLevels.push({ name: 'London Low', price: levels.londonLow, type: 'support' });
    if (levels.prevDayHigh) checkLevels.push({ name: 'PDH', price: levels.prevDayHigh, type: 'resistance' });
    if (levels.prevDayLow) checkLevels.push({ name: 'PDL', price: levels.prevDayLow, type: 'support' });

    const recentSH = confirmedSwings.filter(s => s.type === 'high').slice(-3);
    const recentSL = confirmedSwings.filter(s => s.type === 'low').slice(-3);
    recentSH.forEach(s => checkLevels.push({ name: 'Swing High', price: s.price, type: 'resistance', id: `bsh_${s.time}` }));
    recentSL.forEach(s => checkLevels.push({ name: 'Swing Low', price: s.price, type: 'support', id: `bsl_${s.time}` }));

    for (const level of checkLevels) {
      const levelId = level.id || `${level.name}_${level.price}`;
      if (this.brokenLevelIds.has(levelId)) continue;

      if (level.type === 'resistance') {
        if (candle.close > level.price && candle.open <= level.price) {
          events.push({
            id: `breakout_${levelId}_${candle.time}`,
            type: 'breakout_bullish',
            levelName: level.name,
            levelPrice: level.price,
            breakoutPrice: candle.close,
            time: candle.time,
          });
          this.history.push(events[events.length - 1]);
          this.brokenLevelIds.add(levelId);
        }
      } else {
        if (candle.close < level.price && candle.open >= level.price) {
          events.push({
            id: `breakout_${levelId}_${candle.time}`,
            type: 'breakout_bearish',
            levelName: level.name,
            levelPrice: level.price,
            breakoutPrice: candle.close,
            time: candle.time,
          });
          this.history.push(events[events.length - 1]);
          this.brokenLevelIds.add(levelId);
        }
      }
    }

    return events;
  }

  getHistory() { return [...this.history]; }
  setHistory(h) { this.history = [...h]; }
  resetSession() { this.brokenLevelIds.clear(); }
}
