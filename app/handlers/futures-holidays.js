import { t } from '../../locales/index.js';
import getFuturesHolidays from '../../utils/get-futures-holidays.js';
import { COMMAND_FUTURES_HOLIDAYS } from '../commands/index.js';
import Context from '../context.js';

/**
 * @param {Context} context
 * @returns {boolean}
 */
const check = (context) => context.hasCommand(COMMAND_FUTURES_HOLIDAYS);

/**
 * Parse a 4-digit year from text, defaulting to current year.
 * @param {string} text
 * @returns {number}
 */
const parseYear = (text) => {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
};

/**
 * @param {Context} context
 * @returns {Promise<Context>}
 */
const exec = (context) => check(context) && (
  async () => {
    try {
      const year = parseYear(context.trimmedText);
      const holidays = getFuturesHolidays(year);
      const lines = holidays
        .map((h) => t('__COMMAND_FUTURES_HOLIDAYS_LINE')(h))
        .join('\n');
      const reply = t('__COMMAND_FUTURES_HOLIDAYS_RESULT')(year, lines);
      context.pushText(reply);
    } catch (err) {
      context.pushError(err);
    }
    return context;
  }
)();

export default exec;
