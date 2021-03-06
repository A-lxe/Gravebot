import Promise from 'bluebird';
import chalk from 'chalk';
import _fs from 'fs';
import glob from 'glob';
import googleTranslate from 'google-translate';
import R from 'ramda';
import _request from 'request';
import path from 'path';
import prompt from 'prompt';


if (!process.env.TRANSIFEX_KEY) {
  console.log('TRANSIFEX_KEY env is not set. Exiting.');
  process.exit(1);
}

const fs = Promise.promisifyAll(_fs);
const gt = Promise.promisify(googleTranslate(process.env.GOOGLE_TRANSLATE_API).translate);
const request = Promise.promisify(_request);

const translations_path = path.join(__dirname, '../../i18n');
const translations = R.fromPairs(R.map(file_name => {
  return [path.basename(file_name).replace(/.json/g, ''), require(file_name)];
}, glob.sync(`${translations_path}/*(!(_source.json|en.json))`)));
const _source = require(path.join(translations_path, '_source.json'));

const new_translations = {};
const to_review = R.fromPairs(R.map(lang => [lang, {}], R.keys(translations)));
const transifex_langs = {
  'zh-cn': 'zh-Hans',
  'zh-tw': 'zh-Hant'
};

const trans_keys = Promise.resolve(R.keys(translations));
trans_keys
  .map(lang => {
    const url = `https://${process.env.TRANSIFEX_KEY}@www.transifex.com/api/2/project/gravebot/resource/enjson-33/translation/${transifex_langs[lang] || lang}/?mode=default&file`;
    return request(url)
      .then(R.prop('body'))
      .then(JSON.parse)
      .then(body => {
        new_translations[lang] = body;
        R.forEach(key => {
          if (translations[key] !== new_translations[key]) {
            to_review[lang][key] = {
              translation: new_translations[key],
              original: translations[key]
            };
          }
        }, R.keys(body));

        return;
      });
  }, {concurrency: 10})
  .return(trans_keys)
  .each(lang => {
    if (!R.keys(to_review[lang]).length) return;

    return Promise.resolve(R.keys(to_review[lang]))
      .map(key => {
        return gt(to_review[lang][key].translation, lang, 'en')
          .then(res => {
            to_review[lang][key].reserve = res.translatedText;
          });
      }, {concurrency: 10})
      .then(() => {
        R.forEach(key => {
          console.log(`-----------------------------------
Lang        | ${console.log(chalk.white.bold(lang))}
Key         | ${console.log(chalk.bold.red(key))}
English     | ${console.log(chalk.bold.blue(_source[key].text))}
Reserve     | ${console.log(chalk.bold.green(to_review[lang][key].reserve))}
Old Trans   | ${console.log(chalk.bold.yellow(to_review[lang][key].original))}
New Trans   | ${console.log(chalk.bold.magenta(to_review[lang][key].translation))}`);
        }, R.keys(to_review[lang]));

        return new Promise((resolve, reject) => {
          prompt.start();
          const params = {
            properties: {
              answer: {
                message: 'Would you like to save these translations? [y/n]',
                required: true
              }
            }
          };

          prompt.get(params, (err, res) => {
            if (err) return reject(err);

            if (res.answer === 'y') {
              const merged_translations = R.merge(translations[lang], new_translations[lang]);
              resolve(fs.wrilteFileAsync(path.join(translations_path), `${lang}.json`), JSON.stringify(merged_translations, null, 2), 'utf8');
            } else {
              console.log(chalk.bold.red('Translation not saved...'));
              resolve();
            }
          });
        });
      });
  })
  .then(() => console.log('Review Done'));
