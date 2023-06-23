import { ChatMessageDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/chatMessageData";

interface DmlOptions {
  [key: string]: any;
}

interface FixedItem {
  uuid: string;
  type: 'weapon' | 'equipment' | 'consumable' | 'tool' | 'loot' | 'background' | 'class' | 'subclass' | 'spell' | 'feat' | 'backpack';
  img: string;
  name: string;
  parent: Actor;
  testUserPermission(
    user: User,
    permission: keyof typeof foundry.CONST.DOCUMENT_PERMISSION_LEVELS | foundry.CONST.DOCUMENT_PERMISSION_LEVELS,
    { exact }?: { exact?: boolean }
  ): boolean;
  sheet: {
    render(force?: boolean): void;
  }
}

$(document).on('click', '[data-action="open-item"][data-item-uuid]', async event => {
  const itemUuid = (event.target as HTMLElement).closest('[data-item-uuid]').getAttribute('data-item-uuid');
  const item: FixedItem = await fromUuid(itemUuid) as any;
  item.sheet.render(true);
})

function getChatMsgHtml(item: FixedItem): string {
  const div = document.createElement('div');
  div.innerHTML = /*html*/`
  <div data-action="open-item" data-item-uuid="" class="header" style="margin: 5px 0; padding: 3px 0; display: flex; gap: 4px; cursor: pointer;">
    <img src="placeholder" title="placeholder" width="36" height="36"/>
    <div class="name" style="flex: 1; margin: 0; line-height: 36px; font-size: 20px; font-weight: 700; color: #4b4a44;"></div>
  </div>
  `.replace(/\n/g, ' ').replace(/  +/g, ' ').trim();

  div.querySelector('.header').setAttribute('data-item-uuid', item.uuid);
  div.querySelector('.header img').setAttribute('src', item.img);
  div.querySelector('.header img').setAttribute('title', item.name);
  div.querySelector('.header .name').textContent = item.name;

  return div.innerHTML;
}

Hooks.on('createItem', (item: FixedItem, options: DmlOptions, userId: string) => {
  if (userId !== game.userId) {
    // Only the user to created the item should create a message
    return;
  }
  if (!(item.parent instanceof Actor)) {
    return;
  }
  switch (item.type) {
    case 'background':
    case 'class':
    case 'subclass':
    case 'spell':
    case 'feat': {
      // It's more intended to notify about loot, not these item types
      return;
    }
  }

  let belongsToUser: User;
  const actor: Actor = item.parent;
  for (const user of game.users.values()) {
    if (user.character && user.character.uuid === actor.uuid) {
      belongsToUser = user;
      break;
    }
  }

  if (!belongsToUser) {
    // Don't spam the GM with added items
    return;
  }

  if (belongsToUser.id === game.userId) {
    // If the user added itself, don't create a message
    return;
  }

  const usersWithObserverPerm: User[] = [];
  for (const user of game.users.values()) {
    if (item.testUserPermission(user, 'OBSERVER')) {
      usersWithObserverPerm.push(user);
    }
  }

  const msg: ChatMessageDataConstructorData = {
    type: foundry.CONST.CHAT_MESSAGE_TYPES.OTHER,
    user: game.userId,
    content: getChatMsgHtml(item),
    speaker: ChatMessage.getSpeaker({actor: actor, token: null}),
    flavor: 'You received an item!',
  };
  if (usersWithObserverPerm.length !== game.users.size) {
    msg.type = foundry.CONST.CHAT_MESSAGE_TYPES.WHISPER;
    msg.whisper = usersWithObserverPerm.map(u => u.id);
  }

  ChatMessage.createDocuments([msg]);
});