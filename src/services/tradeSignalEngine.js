import { DisplacementDetector } from './displacementDetector';
import { POIDetector } from './poiDetector';

const MAX_SETUP_AGE_SECONDS = 90 * 60;

export class TradeSignalEngine {
  constructor() {
    this.signals = [];
    this.generatedSetupIds = new Set();
    this.limitHitIds = new Set();
    this.displacementDetector = new DisplacementDetector();
    this.poiDetector = new POIDetector();
  }

  detect(context) {
    const {
      candle,
      candles = [],
      levels = {},
      confirmedSwings = [],
      sweeps = [],
      msEvents = [],
      breakouts = [],
      timeframe = 'm1',
    } = context || {};

    if (!isValidCandle(candle)) return [];

    const recentSweep = [...sweeps]
      .filter(sweep => sweep && sweep.time <= candle.time && candle.time - sweep.time <= MAX_SETUP_AGE_SECONDS)
      .sort((a, b) => b.time - a.time)
      .find(sweep => sweep.type === 'high_sweep' || sweep.type === 'low_sweep');

    if (!recentSweep) return [];

    const side = recentSweep.type === 'high_sweep' ? 'sell' : 'buy';
    const direction = side === 'sell' ? 'bearish' : 'bullish';

    const confirmation = [...msEvents, ...breakouts]
      .filter(event => event && event.time >= recentSweep.time && event.time <= candle.time)
      .filter(event => eventDirection(event) === direction)
      .filter(event => {
        // Only allow cleaner setups: BOS, CHoCH, Valid Break
        const t = event.type || '';
        return t.includes('bos') || t.includes('choch') || t.includes('valid_break');
      })
      .sort((a, b) => b.time - a.time)[0];

    if (!confirmation) return [];

    const setupId = `${side}_${recentSweep.id}_${confirmation.id}`;
    if (this.generatedSetupIds.has(setupId)) return [];

    const displacement = this.displacementDetector.analyze(candles, candle, direction);
    if (!displacement || !displacement.isDisplacement) return [];

    const poi = this.poiDetector.find(candles, candle, side);
    if (!poi) return [];

    const signal = this.buildSignal({
      side,
      direction,
      setupId,
      sweep: recentSweep,
      confirmation,
      displacement,
      poi,
      candle,
      levels,
      confirmedSwings,
      timeframe,
    });

    this.generatedSetupIds.add(setupId);
    this.signals.push(signal);
    this.signals = this.signals.slice(-50);

    return [signal];
  }

  buildSignal({ side, direction, setupId, sweep, confirmation, displacement, poi, candle, levels, confirmedSwings, timeframe }) {
    const entryLow = roundPrice(Math.min(poi.low, poi.high));
    const entryHigh = roundPrice(Math.max(poi.low, poi.high));
    const buffer = roundPrice(Math.max(0.3, displacement.avgRange * 0.25));

    const sl = side === 'sell'
      ? roundPrice(Math.max(sweep.sweepPrice || entryHigh, entryHigh) + buffer)
      : roundPrice(Math.min(sweep.sweepPrice || entryLow, entryLow) - buffer);

    const targets = buildTargets(side, entryLow, entryHigh, sl, levels, confirmedSwings);

    return {
      id: `trade_${setupId}_${candle.time}`,
      setupId,
      type: side === 'sell' ? 'SELL_LIMIT' : 'BUY_LIMIT',
      side,
      direction,
      symbol: 'XAU/USD',
      timeframe,
      entryLow,
      entryHigh,
      entryMid: roundPrice((entryLow + entryHigh) / 2),
      sl,
      tp1: targets.tp1,
      tp2: targets.tp2,
      status: 'waiting_limit',
      confidence: buildConfidence(confirmation, displacement, poi),
      poi,
      sweep,
      confirmation,
      displacement,
      createdPrice: roundPrice(candle.close),
      createdTime: candle.time,
      rationale: [
        `${sweep.levelName || 'Liquidity'} ${sweep.type === 'high_sweep' ? 'BSL sweep' : 'SSL sweep'}`,
        `${confirmationLabel(confirmation)} ${direction}`,
        `${poi.type} POI`,
        `Displacement strength ${displacement.strength.toFixed(2)}x`,
      ],
    };
  }

  checkLimitHits(price, timestamp) {
    if (!Number.isFinite(price)) return [];

    const hits = [];
    for (const signal of this.signals) {
      if (!signal || signal.status !== 'waiting_limit') continue;
      if (this.limitHitIds.has(signal.id)) continue;

      const touched = signal.side === 'buy'
        ? price <= signal.entryHigh
        : price >= signal.entryLow;

      if (!touched) continue;

      signal.status = 'limit_hit';
      signal.hitPrice = roundPrice(price);
      signal.hitTime = timestamp || Math.floor(Date.now() / 1000);
      this.limitHitIds.add(signal.id);
      hits.push({ signal, price: signal.hitPrice, time: signal.hitTime });
    }

    return hits;
  }

  getHistory() {
    return this.signals.map(signal => ({ ...signal }));
  }
}

function buildTargets(side, entryLow, entryHigh, sl, levels, confirmedSwings) {
  const candidates = [];

  if (side === 'sell') {
    addCandidate(candidates, levels.asiaLow);
    addCandidate(candidates, levels.londonLow);
    addCandidate(candidates, levels.nyLow);
    addCandidate(candidates, levels.prevDayLow);
    confirmedSwings.filter(s => s.type === 'low').forEach(s => addCandidate(candidates, s.price));
    const valid = uniquePrices(candidates).filter(price => price < entryLow).sort((a, b) => b - a);
    const risk = Math.max(sl - entryHigh, 0.5);
    return {
      tp1: roundPrice(valid[0] ?? entryLow - risk * 1.5),
      tp2: roundPrice(valid[1] ?? entryLow - risk * 2.5),
    };
  }

  addCandidate(candidates, levels.asiaHigh);
  addCandidate(candidates, levels.londonHigh);
  addCandidate(candidates, levels.nyHigh);
  addCandidate(candidates, levels.prevDayHigh);
  confirmedSwings.filter(s => s.type === 'high').forEach(s => addCandidate(candidates, s.price));
  const valid = uniquePrices(candidates).filter(price => price > entryHigh).sort((a, b) => a - b);
  const risk = Math.max(entryLow - sl, 0.5);

  return {
    tp1: roundPrice(valid[0] ?? entryHigh + risk * 1.5),
    tp2: roundPrice(valid[1] ?? entryHigh + risk * 2.5),
  };
}

function buildConfidence(confirmation, displacement, poi) {
  let score = 50;
  if (confirmation.type?.startsWith('valid_break')) score += 15;
  if (confirmation.type === 'bos' || confirmation.type === 'choch') score += 10;
  if (displacement.strength >= 1.5) score += 15;
  else if (displacement.strength >= 1.25) score += 10;
  if (poi.type.includes('OB')) score += 10;
  return Math.min(95, Math.max(50, Math.round(score)));
}

function eventDirection(event) {
  if (event.direction === 'bullish' || event.direction === 'bearish') return event.direction;
  if (event.type?.endsWith('_bullish')) return 'bullish';
  if (event.type?.endsWith('_bearish')) return 'bearish';
  return null;
}

function confirmationLabel(event) {
  if (event.type === 'bos') return 'BOS';
  if (event.type === 'choch') return 'CHoCH';
  if (event.type?.startsWith('valid_break')) return 'Valid Break';
  if (event.type?.startsWith('breakout')) return 'Breakout';
  return 'Structure confirmation';
}

function addCandidate(candidates, price) {
  if (Number.isFinite(price)) candidates.push(roundPrice(price));
}

function uniquePrices(candidates) {
  return [...new Set(candidates.map(price => roundPrice(price)))];
}

function isValidCandle(candle) {
  return candle &&
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close);
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}
