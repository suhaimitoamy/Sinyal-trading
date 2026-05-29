import { DateTime } from 'luxon';

// Session times in New York timezone (auto DST via luxon)
const SESSIONS = {
  asia:   { start: 18, end: 0 },   // 18:00 - 00:00 NY (crosses midnight)
  london: { start: 2, end: 5 },    // 02:00 - 05:00 NY
  ny:     { start: 7, end: 11 },   // 07:00 - 11:00 NY
};

export class SessionLevelTracker {
  constructor() {
    this.levels = {
      asiaHigh: null, asiaLow: null,
      londonHigh: null, londonLow: null,
      nyHigh: null, nyLow: null,
      prevDayHigh: null, prevDayLow: null,
    };
    this.sessionActive = { asia: false, london: false, ny: false };
    this.currentDay = null; // NY trading day string
    this.dayHigh = null;
    this.dayLow = null;
  }

  processCandle(m1Candle) {
    const nyTime = DateTime.fromSeconds(m1Candle.time, { zone: 'America/New_York' });
    const hour = nyTime.hour;
    
    // Trading day logic: new trading day starts at 18:00 NY time
    // We can represent the trading day by the date of the next day if hour >= 18
    const tradingDate = hour >= 18 ? nyTime.plus({ days: 1 }).toISODate() : nyTime.toISODate();

    if (this.currentDay !== tradingDate) {
      if (this.currentDay) {
        // Save previous day levels
        this.levels.prevDayHigh = this.dayHigh;
        this.levels.prevDayLow = this.dayLow;
      }
      this.currentDay = tradingDate;
      this.dayHigh = m1Candle.high;
      this.dayLow = m1Candle.low;
      
      // Reset session levels for the new trading day
      this.levels.asiaHigh = null; this.levels.asiaLow = null;
      this.levels.londonHigh = null; this.levels.londonLow = null;
      this.levels.nyHigh = null; this.levels.nyLow = null;
    } else {
      this.dayHigh = Math.max(this.dayHigh || m1Candle.high, m1Candle.high);
      this.dayLow = Math.min(this.dayLow || m1Candle.low, m1Candle.low);
    }

    // Determine active sessions
    const asiaActive = hour >= SESSIONS.asia.start || hour < SESSIONS.asia.end;
    const londonActive = hour >= SESSIONS.london.start && hour < SESSIONS.london.end;
    const nyActive = hour >= SESSIONS.ny.start && hour < SESSIONS.ny.end;

    this.sessionActive = { asia: asiaActive, london: londonActive, ny: nyActive };

    // Update session highs and lows
    if (asiaActive) {
      this.levels.asiaHigh = Math.max(this.levels.asiaHigh || m1Candle.high, m1Candle.high);
      this.levels.asiaLow = Math.min(this.levels.asiaLow || m1Candle.low, m1Candle.low);
    }
    if (londonActive) {
      this.levels.londonHigh = Math.max(this.levels.londonHigh || m1Candle.high, m1Candle.high);
      this.levels.londonLow = Math.min(this.levels.londonLow || m1Candle.low, m1Candle.low);
    }
    if (nyActive) {
      this.levels.nyHigh = Math.max(this.levels.nyHigh || m1Candle.high, m1Candle.high);
      this.levels.nyLow = Math.min(this.levels.nyLow || m1Candle.low, m1Candle.low);
    }
  }

  getLevels() {
    return { ...this.levels };
  }

  getSessionStatus() {
    return { ...this.sessionActive };
  }

  setLevels(levels) {
    this.levels = { ...levels };
  }
}
