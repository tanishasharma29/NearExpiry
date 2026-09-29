/**
 * Timezone-Safe Shelf-Life & Batch Status Engine for NearExpiry.
 *
 * The backend is the single authoritative source of truth for expiry calculations.
 * Never relies on client/React clocks.
 */

export const BATCH_STATUS = Object.freeze({
  NORMAL: 'NORMAL',
  APPROACHING_EXPIRY: 'APPROACHING_EXPIRY',
  CRITICAL: 'CRITICAL',
  EXPIRED: 'EXPIRED',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Converts any Date or ISO string into a timezone-normalized UTC midnight timestamp
 * representing the calendar day (YYYY-MM-DD) in the target IANA timezone.
 *
 * @param {Date|string} dateInput
 * @param {string} [timeZone='UTC']
 * @returns {number} UTC midnight epoch milliseconds for that calendar date
 */
export const toCalendarDayEpochUTC = (dateInput, timeZone = process.env.APP_TIMEZONE || 'UTC') => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date supplied to shelf-life calculator: ${dateInput}`);
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(d);
    const year = Number(parts.find((p) => p.type === 'year').value);
    const month = Number(parts.find((p) => p.type === 'month').value) - 1;
    const day = Number(parts.find((p) => p.type === 'day').value);
    return Date.UTC(year, month, day);
  } catch (_) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
};

/**
 * Computes exact integer remaining calendar days until expiryDate.
 * - < 0 : Expired
 * - 0   : Expires today (last day of validity)
 * - > 0 : Days remaining in shelf life
 *
 * @param {Date|string} expiryDate
 * @param {Date|string} [referenceDate=new Date()]
 * @param {string} [timeZone]
 * @returns {number}
 */
export const calculateRemainingDays = (
  expiryDate,
  referenceDate = new Date(),
  timeZone = process.env.APP_TIMEZONE || 'UTC'
) => {
  const expEpoch = toCalendarDayEpochUTC(expiryDate, timeZone);
  const refEpoch = toCalendarDayEpochUTC(referenceDate, timeZone);
  return Math.floor((expEpoch - refEpoch) / MS_PER_DAY);
};

/**
 * Resolves the authoritative Batch status from remainingDays and sellable quantity.
 * Rule: EXPIRED always takes highest priority so expired stock is permanently locked.
 *
 * @param {number} remainingDays
 * @param {number} quantity
 * @returns {string}
 */
export const computeBatchStatus = (remainingDays, quantity) => {
  if (remainingDays < 0) {
    return BATCH_STATUS.EXPIRED;
  }
  if (quantity <= 0) {
    return BATCH_STATUS.OUT_OF_STOCK;
  }
  if (remainingDays <= 7) {
    return BATCH_STATUS.CRITICAL;
  }
  if (remainingDays <= 30) {
    return BATCH_STATUS.APPROACHING_EXPIRY;
  }
  return BATCH_STATUS.NORMAL;
};

/**
 * Determines whether a batch is legally and operationally purchasable.
 */
export const isBatchPurchasable = (remainingDays, quantity, status) => {
  return (
    remainingDays >= 0 &&
    quantity > 0 &&
    status !== BATCH_STATUS.EXPIRED &&
    status !== BATCH_STATUS.OUT_OF_STOCK
  );
};
