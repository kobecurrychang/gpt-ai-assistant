import {
  afterEach, beforeEach, expect, test,
} from '@jest/globals';
import { getPrompt, handleEvents, removePrompt } from '../app/index.js';
import { COMMAND_SYS_PROFILE } from '../app/commands/index.js';
import { t } from '../locales/index.js';
import { createEvents, MOCK_USER_01, TIMEOUT } from './utils.js';

beforeEach(() => {
  //
});

afterEach(() => {
  removePrompt(MOCK_USER_01);
});

test('COMMAND_SYS_PROFILE view', async () => {
  const events = [
    ...createEvents([COMMAND_SYS_PROFILE.text]),
  ];
  let results;
  try {
    results = await handleEvents(events);
  } catch (err) {
    console.error(err);
  }
  expect(getPrompt(MOCK_USER_01).messages.length).toEqual(3);
  const replies = results.map(({ messages }) => messages.map(({ text }) => text));
  expect(replies).toEqual(
    [
      [t('__COMMAND_SYS_PROFILE_REPLY')('user', true)],
    ],
  );
}, TIMEOUT);

test('COMMAND_SYS_PROFILE update name', async () => {
  const newName = '新名字';
  const events = [
    ...createEvents([`${COMMAND_SYS_PROFILE.text} ${newName}`]),
  ];
  let results;
  try {
    results = await handleEvents(events);
  } catch (err) {
    console.error(err);
  }
  expect(getPrompt(MOCK_USER_01).messages.length).toEqual(3);
  const replies = results.map(({ messages }) => messages.map(({ text }) => text));
  expect(replies).toEqual(
    [
      [t('__COMMAND_SYS_PROFILE_UPDATED_REPLY')(newName)],
    ],
  );
}, TIMEOUT);
