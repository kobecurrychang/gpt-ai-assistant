import { TYPE_FUTURES } from '../../constants/command.js';
import { t } from '../../locales/index.js';
import Command from './command.js';

export default new Command({
  type: TYPE_FUTURES,
  label: t('__COMMAND_FUTURES_SETTLEMENTS_LABEL'),
  text: t('__COMMAND_FUTURES_SETTLEMENTS_TEXT'),
  aliases: [
    ...t('__COMMAND_FUTURES_SETTLEMENTS_ALIASES'),
    '/futures-settlements',
  ],
});
