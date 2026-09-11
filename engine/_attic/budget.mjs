// The BUDGET LEDGER — a hard spend ceiling that cannot be crossed.
//
// The requirement is "even under heavy force it must not cross a given budget",
// so this is built as a RESERVE-then-COMMIT ledger rather than a counter that
// is checked and incremented. A check-then-spend counter has a race: two
// concurrent renders both read 0.90 of a 1.00 cap, both decide they fit, and
// the cap is breached. Reserving first makes the decision and the deduction one
// step, so the second caller sees the first's reservation and is refused.
//
// Every spend is also durable: the ledger is appended to disk before the API
// call is made, never after. A crash mid-call loses the RESULT, never the
// record of the spend — the opposite bias would let a crash-loop spend without
// limit.
import fs from 'node:fs';
import path from 'node:path';

export class BudgetExceeded extends Error {
  constructor(msg, detail) { super(msg); this.name = 'BudgetExceeded'; this.detail = detail; }
}

/** Money is cents-as-integers. Floats accumulate error over thousands of rows. */
const cents = (usd) => Math.round(Number(usd) * 100000); // 1e-5 USD resolution
const usd = (c) => c / 100000;

export class BudgetLedger {
  /**
   * @param {object} o
   * @param {string} o.file          append-only JSONL ledger
   * @param {number} o.capUsd        hard ceiling for this scope
   * @param {string} o.scope         campaign id, user id, whatever is being capped
   */
  constructor({ file, capUsd, scope }) {
    this.file = file;
    this.scope = scope;
    this.capC = cents(capUsd);
    this.reservedC = 0;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.spentC = this.#replay();
  }

  /** Spend is the sum of committed rows. Reservations are in-process only. */
  #replay() {
    if (!fs.existsSync(this.file)) return 0;
    let total = 0;
    for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row.scope === this.scope && row.type === 'commit') total += row.c;
      } catch { /* a torn final line is ignored, never fatal */ }
    }
    return total;
  }

  get spentUsd() { return usd(this.spentC); }
  get capUsd() { return usd(this.capC); }
  get remainingUsd() { return usd(Math.max(0, this.capC - this.spentC - this.reservedC)); }

  /**
   * Reserve headroom BEFORE calling a paid API. Throws rather than returning
   * false: a caller that ignores a boolean is the exact failure this guards.
   */
  reserve(estimateUsd, note = '') {
    const c = cents(estimateUsd);
    if (c < 0) throw new BudgetExceeded('negative estimate', { estimateUsd });
    if (this.spentC + this.reservedC + c > this.capC) {
      throw new BudgetExceeded(
        `budget exhausted for "${this.scope}": cap $${this.capUsd.toFixed(4)}, ` +
        `spent $${this.spentUsd.toFixed(4)}, reserved $${usd(this.reservedC).toFixed(4)}, ` +
        `this call $${Number(estimateUsd).toFixed(4)}`,
        { scope: this.scope, capUsd: this.capUsd, spentUsd: this.spentUsd, estimateUsd },
      );
    }
    this.reservedC += c;
    return { c, note, release: () => { this.reservedC = Math.max(0, this.reservedC - c); } };
  }

  /**
   * Commit the ACTUAL cost once known. Written to disk synchronously, so the
   * spend survives a crash even if the caller never sees the response.
   */
  commit(reservation, actualUsd, meta = {}) {
    const c = cents(actualUsd);
    this.reservedC = Math.max(0, this.reservedC - reservation.c);
    this.spentC += c;
    fs.appendFileSync(this.file, JSON.stringify({
      type: 'commit', scope: this.scope, c, usd: usd(c),
      at: new Date().toISOString(), note: reservation.note, ...meta,
    }) + '\n');
    // An over-run on the ACTUAL cost is recorded, then surfaced. Refusing to
    // record it would make the ledger lie; the next reserve() will refuse.
    if (this.spentC > this.capC) {
      return { overrun: true, spentUsd: this.spentUsd, capUsd: this.capUsd };
    }
    return { overrun: false, spentUsd: this.spentUsd };
  }

  /** Wrap any paid call: reserve, run, commit actual, release on failure. */
  async spend(estimateUsd, meta, fn) {
    const r = this.reserve(estimateUsd, meta?.note || '');
    try {
      const { result, actualUsd } = await fn();
      this.commit(r, actualUsd ?? estimateUsd, meta);
      return result;
    } catch (e) {
      r.release();          // a failed call costs nothing and must not hold headroom
      throw e;
    }
  }
}

/**
 * Per-tier ceilings. These are the numbers the plan is priced on; a run that
 * would exceed one stops rather than silently eating the margin.
 */
export const CAPS = {
  carousel: 0.25,     // one 7-slide set, all in
  campaignSetup: 6.0, // mascot sheet + hero library + art direction, once
  userMonth: 6.12,    // 40% net margin floor on the $20 attributed case
};
