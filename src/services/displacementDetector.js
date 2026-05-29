export class DisplacementDetector {
  constructor(options = {}) {
    this.lookback = options.lookback || 20;
    this.minBodyRatio = options.minBodyRatio || 0.55;
    this.minRangeMultiplier = options.minRangeMultiplier || 1.25;
    this.minBodyMultiplier = options.minBodyMultiplier || 1.2;
  }

  analyze(candles, candle, forcedDirection = null) {
    if (!isValidCandle(candle)) return null;

    const range = Math.max(candle.high - candle.low, 0);
    const body = Math.abs(candle.close - candle.open);
    const direction = forcedDirection || getCandleDirection(candle);
    if (!direction || range <= 0) return null;

    const previous = (candles || [])
      .filter(c => isValidCandle(c) && c.time < candle.time)
      .slice(-this.lookback);

    const avgRange = average(previous.map(c => Math.max(c.high - c.low, 0))) || range;
    const avgBody = average(previous.map(c => Math.abs(c.close - c.open))) || body || avgRange * 0.5;
    const bodyRatio = range > 0 ? body / range : 0;
    const closeNearExtreme = direction === 'bullish'
      ? (candle.high - candle.close) <= range * 0.35
      : (candle.close - candle.low) <= range * 0.35;

    const rangeStrength = avgRange > 0 ? range / avgRange : 1;
    const bodyStrength = avgBody > 0 ? body / avgBody : 1;
    const isDisplacement =
      bodyRatio >= this.minBodyRatio &&
      closeNearExtreme &&
      (rangeStrength >= this.minRangeMultiplier || bodyStrength >= this.minBodyMultiplier);

    return {
      isDisplacement,
      direction,
      range,
      body,
      bodyRatio,
      avgRange,
      avgBody,
      rangeStrength,
      bodyStrength,
      strength: Math.max(rangeStrength, bodyStrength),
    };
  }
}

function getCandleDirection(candle) {
  if (candle.close > candle.open) return 'bullish';
  if (candle.close < candle.open) return 'bearish';
  return null;
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
