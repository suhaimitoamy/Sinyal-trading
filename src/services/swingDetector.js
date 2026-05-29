export class SwingDetector {
  constructor(strength = 3) {
    this.strength = strength;
    this.confirmedSwings = [];
    this.candidateSwings = [];
  }

  processCandles(candles) {
    this.candidateSwings = [];
    const N = this.strength;

    if (candles.length < 2 * N + 1) return { confirmed: this.confirmedSwings, candidates: this.candidateSwings };

    for (let i = N; i < candles.length - N; i++) {
      let isSwingHigh = true;
      let isSwingLow = true;

      for (let j = 1; j <= N; j++) {
        if (candles[i].high <= candles[i - j].high) isSwingHigh = false;
        if (candles[i].high <= candles[i + j].high) isSwingHigh = false;
        if (candles[i].low >= candles[i - j].low) isSwingLow = false;
        if (candles[i].low >= candles[i + j].low) isSwingLow = false;
      }

      if (isSwingHigh) {
        const swing = { type: 'high', price: candles[i].high, time: candles[i].time, index: i, status: 'confirmed' };
        if (!this.confirmedSwings.find(s => s.time === swing.time && s.type === swing.type)) {
          this.confirmedSwings.push(swing);
        }
      }

      if (isSwingLow) {
        const swing = { type: 'low', price: candles[i].low, time: candles[i].time, index: i, status: 'confirmed' };
        if (!this.confirmedSwings.find(s => s.time === swing.time && s.type === swing.type)) {
          this.confirmedSwings.push(swing);
        }
      }
    }

    // Candidates
    for (let i = Math.max(N, candles.length - N); i < candles.length; i++) {
      let isCandidate_High = true;
      let isCandidate_Low = true;

      for (let j = 1; j <= N; j++) {
        if (i - j < 0) { isCandidate_High = false; isCandidate_Low = false; break; }
        if (candles[i].high <= candles[i - j].high) isCandidate_High = false;
        if (candles[i].low >= candles[i - j].low) isCandidate_Low = false;
      }

      for (let j = 1; j < candles.length - i; j++) {
        if (candles[i].high <= candles[i + j].high) isCandidate_High = false;
        if (candles[i].low >= candles[i + j].low) isCandidate_Low = false;
      }

      if (isCandidate_High && !this.confirmedSwings.find(s => s.time === candles[i].time && s.type === 'high')) {
        this.candidateSwings.push({ type: 'high', price: candles[i].high, time: candles[i].time, index: i, status: 'candidate' });
      }
      if (isCandidate_Low && !this.confirmedSwings.find(s => s.time === candles[i].time && s.type === 'low')) {
        this.candidateSwings.push({ type: 'low', price: candles[i].low, time: candles[i].time, index: i, status: 'candidate' });
      }
    }

    return { confirmed: this.confirmedSwings, candidates: this.candidateSwings };
  }

  getConfirmedSwings() { return [...this.confirmedSwings]; }
  getCandidateSwings() { return [...this.candidateSwings]; }
  setStrength(n) { this.strength = n; }
  setSwings(swings) { this.confirmedSwings = [...swings]; }
}
