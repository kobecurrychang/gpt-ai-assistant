import { t } from '../../locales/index.js';
import { COMMAND_SYS_PROFILE, GENERAL_COMMANDS } from '../commands/index.js';
import Context from '../context.js';
import { updateHistory } from '../history/index.js';
import { updateSources } from '../repository/index.js';

/**
 * @param {Context} context
 * @returns {boolean}
 */
const check = (context) => context.hasCommand(COMMAND_SYS_PROFILE);

/**
 * @param {Context} context
 * @returns {Promise<Context>}
 */
const exec = (context) => check(context) && (
  async () => {
    updateHistory(context.id, (history) => history.erase());
    const commandTexts = [COMMAND_SYS_PROFILE.text, ...COMMAND_SYS_PROFILE.aliases];
    const rawContent = context.trimmedText;
    let newName = rawContent;
    for (const commandText of commandTexts) {
      if (rawContent.toLowerCase().startsWith(commandText.toLowerCase())) {
        newName = rawContent.slice(commandText.length);
        break;
      }
    }
    newName = newName.replace(/[。？！?.!]$/, '').trim();
    if (newName) {
      try {
        await updateSources(context.id, (source) => {
          source.name = newName;
        });
        context.pushText(t('__COMMAND_SYS_PROFILE_UPDATED_REPLY')(newName), GENERAL_COMMANDS);
      } catch (err) {
        context.pushError(err);
      }
    } else {
      const { name, bot } = context.source;
      context.pushText(t('__COMMAND_SYS_PROFILE_REPLY')(name, bot.isActivated), GENERAL_COMMANDS);
    }
    return context;
  }
)();

export default exec;
