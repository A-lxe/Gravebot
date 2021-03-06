import R from 'ramda';
import Wiki from 'wikijs';

import T from '../../translate';

function wiki(bot, msg, suffix) {
  if (!suffix) {
    bot.sendMessage(msg.channel, T('wiki_usage', msg.author.lang));
    return;
  }
  new Wiki().search(suffix, 1).then(data => {
    new Wiki().page(data.results[0]).then(page => {
      page.summary().then(summary => {
        const sum_text = summary.toString().split('\n');
        R.forEach(paragraph => {
          bot.sendMessage(msg.channel, paragraph);
        }, sum_text);
      });
    });
  });
}

export default {
  wiki,
  wikipedia: wiki
};

export const help = {
  wiki: {parameters: ['search terms']}
};
