export class BreakoutDetector {
  constructor() {
    this.history = [];
    this.brokenLevelIds = new Set();
    this.pendingBreaks = new Map();
    this.resolvedBreaks = new Set();
  }

  detect(candle, levels = {}, confirmedSwings = [], previousCandles = []) {
    const events = [];
    if (!isValidCandle(candle)) return events;

    this.resolvePendingBreaks(candle, previousCandles, events);

    const checkLevels = buildCheckLevels(levels, confirmedSwings);

    for (const level of checkLevels) {
      const levelId = level.id || `${level.name}_${level.price}`;
      if (this.brokenLevelIds.has(levelId)) continue;
      if (!Number.isFinite(level.price)) continue;

      if (level.type === 'resistance') {
        if (candle.close > level.price && candle.open <= level.price) {
          const quality = measureBreakQuality(candle, level.price, 'bullish', previousCandles);
          const event = buildBreakoutEvent(levelId, level, candle, 'bullish', quality);
          events.push(event);
          this.history.push(event);
          this.brokenLevelIds.add(levelId);
          this.pendingBreaks.set(levelId, { ...event, status: 'watching' });

          if (quality.isStrong) {
            const validEvent = buildValidBreakEvent(levelId, level, candle, 'bullish', quality, 'strong_close');
            events.push(validEvent);
            this.history.push(validEvent);
            this.pendingBreaks.delete(levelId);
            this.resolvedBreaks.add(levelId);
          }
        }
      } else if (level.type === 'support') {
        if (candle.close < level.price && candle.open >= level.price) {
          const quality = measureBreakQuality(candle, level.price, 'bearish', previousCandles);
          const event = buildBreakoutEvent(levelId, level, candle, 'bearish', quality);
          events.push(event);
          this.history.push(event);
          this.brokenLevelIds.add(levelId);
          this.pendingBreaks.set(levelId, { ...event, status: 'watching' });

          if (quality.isStrong) {
            const validEvent = buildValidBreakEvent(levelId, level, candle, 'bearish', quality, 'strong_close');
            events.push(validEvent);
            this.history.push(validEvent);
            this.pendingBreaks.delete(levelId);
            this.resolvedBreaks.add(levelId);
          }
        }
      }
    }

    return events;
  }

  resolvePendingBreaks(candle, previousCandles, events) {
    for (const [levelId, pending] of this.pendingBreaks.entries()) {
      if (!pending || this.resolvedBreaks.has(levelId)) continue;
      if (candle.time <= pending.time) continue;

      const direction = pending.direction;
      const level = pending.levelPrice;
      const quality = measureBreakQuality(candle, level, direction, previousCandles);

      if (direction === 'bullish') {
        if (candle.close < level) {
          const fakeEvent = buildFakeBreakEvent(levelId, pending, candle, 'bearish');
          events.push(fakeEvent);
          this.history.push(fakeEvent);
          this.pendingBreaks.delete(levelId);
          this.resolvedBreaks.add(levelId);
        } else if ((candle.low <= level && candle.close > level) || candle.close > pending.breakoutPrice) {
          const validEvent = buildValidBreakEvent(levelId, pending, candle, 'bullish', quality, 'hold_or_retest');
          events.push(validEvent);
          this.history.push(validEvent);
          this.pendingBreaks.delete(levelId);
          this.resolvedBreaks.add(levelId);
        }
      } else if (direction === 'bearish') {
        if (candle.close > level) {
          const fakeEvent = buildFakeBreakEvent(levelId, pending, candle, 'bullish');
          events.push(fakeEvent);
          this.history.push(fakeEvent);
          this.pendingBreaks.delete(levelId);
          this.resolvedBreaks.add(levelId);
        } else if ((candle.high >= level && candle.close < level) || candle.close < pending.breakoutPrice) {
          const validEvent = buildValidBreakEvent(levelId, pending, candle, 'bearish', quality, 'hold_or_retest');
          events.push(validEvent);
          this.history.push(validEvent);
          this.pendingBreaks.delete(levelId);
          this.resolvedBreaks.add(levelId);
        }
      }
    }
  }

  getHistory() { return [...this.history]; }
  setHistory(h) { this.history = [...h]; }
  resetSession() {
    this.brokenLevelIds.clear();
    this.pendingBreaks.clear();
    this.resolvedBreaks.clear();
  }
}

function buildCheckLevels(levels, confirmedSwings) {
  const checkLevels = [];

  if (Number.isFinite(levels.asiaHigh)) checkLevels.push({ name: 'Asia High', price: levels.asiaHigh, type: 'resistance' });
  if (Number.isFinite(levels.asiaLow)) checkLevels.push({ name: 'Asia Low', price: levels.asiaLow, type: 'support' });
  if (Number.isFinite(levels.londonHigh)) checkLevels.push({ name: 'London High', price: levels.londonHigh, type: 'resistance' });
  if (Number.isFinite(levels.londonLow)) checkLevels.push({ name: 'London Low', price: levels.londonLow, type: 'support' });
  if (Number.isFinite(levels.nyHigh)) checkLevels.push({ name: 'NY High', price: levels.nyHigh, type: 'resistance' });
  if (Number.isFinite(levels.nyLow)) checkLevels.push({ name: 'NY Low', price: levels.nyLow, type: 'support' });
  if (Number.isFinite(levels.prevDayHigh)) checkLevels.push({ name: 'PDH', price: levels.prevDayHigh, type: 'resistance' });
  if (Number.isFinite(levels.prevDayLow)) checkLevels.push({ name: 'PDL', price: levels.prevDayLow, type: 'support' });

  const recentSH = (confirmedSwings || []).filter(s => s.type === 'high').slice(-3);
  const recentSL = (confirmedSwings || []).filter(s => s.type === 'low').slice(-3);
  recentSH.forEach(s => checkLevels.push({ name: 'Swing High', price: s.price, type: 'resistance', id: `bsh_${s.time}` }));
  recentSL.forEach(s => checkLevels.push({ name: 'Swing Low', price: s.price, type: 'support', id: `bsl_${s.time}` }));

  return checkLevels;
}

function buildBreakoutEvent(levelId, level, candle, direction, quality) {
  return {
    id: `breakout_${levelId}_${candle.time}`,
    type: direction === 'bullish' ? 'breakout_bullish' : 'breakout_bearish',
    direction,
    levelName: level.name,
    levelPrice: level.price,
    breakoutPrice: candle.close,
    price: candle.close,
    time: candle.time,
    status: quality.isStrong ? 'valid_candidate' : 'watching',
    strength: quality.strength,
    bodyRatio: quality.bodyRatio,
  };
}

function buildValidBreakEvent(levelId, level, candle, direction, quality, validationType) {
  return {
    id: `valid_break_${levelId}_${candle.time}`,
    type: direction === 'bullish' ? 'valid_break_bullish' : 'valid_break_bearish',
    direction,
    levelName: level.levelName || level.name,
    levelPrice: level.levelPrice || level.price,
    breakoutPrice: candle.close,
    price: candle.close,
    time: candle.time,
    validationType,
    strength: quality.strength,
    bodyRatio: quality.bodyRatio,
  };
}

function buildFakeBreakEvent(levelId, pending, candle, direction) {
  return {
    id: `fake_break_${levelId}_${candle.time}`,
    type: direction === 'bullish' ? 'fake_break_bullish' : 'fake_break_bearish',
    direction,
    levelName: pending.levelName,
    levelPrice: pending.levelPrice,
    breakoutPrice: candle.close,
    price: candle.close,
    time: candle.time,
    failedBreakTime: pending.time,
  };
}

function measureBreakQuality(candle, levelPrice, direction, previousCandles) {
  const range = Math.max(candle.high - candle.low, 0);
  const body = Math.abs(candle.close - candle.open);
  const bodyRatio = range > 0 ? body / range : 0;
  const previous = (previousCandles || []).filter(c => isValidCandle(c) && c.time < candle.time).slice(-20);
  const avgRange = average(previous.map(c => Math.max(c.high - c.low, 0))) || range || 1;
  const distanceFromLevel = Math.abs(candle.close - levelPrice);
  const distanceStrength = avgRange > 0 ? distanceFromLevel / avgRange : 0;
  const rangeStrength = avgRange > 0 ? range / avgRange : 1;
  const closeNearExtreme = direction === 'bullish'
    ? (candle.high - candle.close) <= range * 0.35
    : (candle.close - candle.low) <= range * 0.35;

  const isStrong = bodyRatio >= 0.55 && closeNearExtreme && (rangeStrength >= 1.15 || distanceStrength >= 0.15);

  return {
    isStrong,
    strength: Math.max(rangeStrength, distanceStrength),
    bodyRatio,
    rangeStrength,
    distanceStrength,
  };
}

function isValidCandle(candle) {
  return candle &&
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close);
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}
