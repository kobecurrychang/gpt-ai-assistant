import { TYPE_FUTURES } from '../../constants/command.js';
import { t } from '../../locales/index.js';
import Command from './command.js';

export default new Command({
  type: TYPE_FUTURES,
  label: t('__COMMAND_FUTURES_HOLIDAYS_LABEL'),
  text: t('__COMMAND_FUTURES_HOLIDAYS_TEXT'),
  aliases: [
    ...t('__COMMAND_FUTURES_HOLIDAYS_ALIASES'),
    '/futures-holidays',
  ],
});
