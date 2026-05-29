export class POIDetector {
  constructor(options = {}) {
    this.lookback = options.lookback || 12;
  }

  find(candles, displacementCandle, side) {
    if (!isValidCandle(displacementCandle)) return null;
    if (side !== 'buy' && side !== 'sell') return null;

    const previous = (candles || [])
      .filter(c => isValidCandle(c) && c.time < displacementCandle.time)
      .slice(-this.lookback);

    const orderBlock = this.findOrderBlock(previous, side);
    if (orderBlock) return orderBlock;

    return this.buildRetracementPOI(displacementCandle, side);
  }

  findOrderBlock(previous, side) {
    const reversed = [...previous].reverse();
    const source = side === 'buy'
      ? reversed.find(c => c.close < c.open)
      : reversed.find(c => c.close > c.open);

    if (!source) return null;

    const zone = side === 'buy'
      ? {
          low: source.low,
          high: Math.max(source.open, source.close),
        }
      : {
          low: Math.min(source.open, source.close),
          high: source.high,
        };

    if (!isValidZone(zone.low, zone.high)) return null;

    return {
      type: side === 'buy' ? 'Demand OB' : 'Supply OB',
      low: roundPrice(zone.low),
      high: roundPrice(zone.high),
      sourceCandleTime: source.time,
    };
  }

  buildRetracementPOI(candle, side) {
    const range = Math.max(candle.high - candle.low, 0);
    if (range <= 0) return null;

    let low;
    let high;

    if (side === 'buy') {
      low = candle.low + range * 0.45;
      high = candle.low + range * 0.65;
    } else {
      low = candle.high - range * 0.65;
      high = candle.high - range * 0.45;
    }

    if (!isValidZone(low, high)) return null;

    return {
      type: 'Displacement Retracement',
      low: roundPrice(low),
      high: roundPrice(high),
      sourceCandleTime: candle.time,
    };
  }
}

function isValidCandle(candle) {
  return candle &&
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close);
}

function isValidZone(low, high) {
  return Number.isFinite(low) && Number.isFinite(high) && high > low;
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}
