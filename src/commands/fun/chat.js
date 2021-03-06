import Cleverbot from 'cleverbot-node';
import ent from 'entities';
import nconf from 'nconf';

import sentry from '../../sentry';
import T from '../../translate';


const clever = new Cleverbot(nconf.get('CLEVERBOT_API_NAME'), nconf.get('CLEVERBOT_API_KEY'));

function chat(bot, msg, suffix) {
  if (!nconf.get('CLEVERBOT_API_NAME') || !nconf.get('CLEVERBOT_API_KEY')) {
    bot.sendMessage(msg.channel, T('chat_usage', msg.author.lang));
    return;
  }

  if (!suffix) suffix = 'Hello.';

  // If cleverbot doesn't respond in 15 seconds, stop typing.
  let typingTimeout = setTimeout(() => bot.stopTyping(msg.channel), 15000);

  bot.startTyping(msg.channel);
  Cleverbot.prepare(() => {
    try {
      clever.write(suffix, (response) => {
        if (/\|/g.test(response.message)) {
          response.message = response.message.replace(/\|/g, '\\u');
          response.message = response.message.replace(/\\u([\d\w]{4})/gi, (match, grp) => {
            return String.fromCharCode(parseInt(grp, 16));
          });
        }
        bot.sendMessage(msg, ent.decodeHTML(response.message));
        bot.stopTyping(msg.channel);
        clearTimeout(typingTimeout);
      });
    } catch (err) {
      sentry(err, 'chat');
      bot.sendMessage(msg.channel, `Error: ${err.message}`);
      bot.stopTyping(msg.channel);
      clearTimeout(typingTimeout);
    }
  });
}

export default {
  chat
};

export const help = {
  chat: {
    parameters: ['text']
  }
};
