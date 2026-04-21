import { LANGUAGES } from '@grafana/i18n';

function __variableDynamicImportRuntime0__(path) {
  switch (path) {
    case '../locales/cs-CZ/grafana-scenes.json': return import('../locales/cs-CZ/grafana-scenes.json.js');
    case '../locales/de-DE/grafana-scenes.json': return import('../locales/de-DE/grafana-scenes.json.js');
    case '../locales/en-US/grafana-scenes.json': return import('../locales/en-US/grafana-scenes.json.js');
    case '../locales/es-ES/grafana-scenes.json': return import('../locales/es-ES/grafana-scenes.json.js');
    case '../locales/fr-FR/grafana-scenes.json': return import('../locales/fr-FR/grafana-scenes.json.js');
    case '../locales/hu-HU/grafana-scenes.json': return import('../locales/hu-HU/grafana-scenes.json.js');
    case '../locales/id-ID/grafana-scenes.json': return import('../locales/id-ID/grafana-scenes.json.js');
    case '../locales/it-IT/grafana-scenes.json': return import('../locales/it-IT/grafana-scenes.json.js');
    case '../locales/ja-JP/grafana-scenes.json': return import('../locales/ja-JP/grafana-scenes.json.js');
    case '../locales/ko-KR/grafana-scenes.json': return import('../locales/ko-KR/grafana-scenes.json.js');
    case '../locales/nl-NL/grafana-scenes.json': return import('../locales/nl-NL/grafana-scenes.json.js');
    case '../locales/pl-PL/grafana-scenes.json': return import('../locales/pl-PL/grafana-scenes.json.js');
    case '../locales/pt-BR/grafana-scenes.json': return import('../locales/pt-BR/grafana-scenes.json.js');
    case '../locales/pt-PT/grafana-scenes.json': return import('../locales/pt-PT/grafana-scenes.json.js');
    case '../locales/ru-RU/grafana-scenes.json': return import('../locales/ru-RU/grafana-scenes.json.js');
    case '../locales/sv-SE/grafana-scenes.json': return import('../locales/sv-SE/grafana-scenes.json.js');
    case '../locales/tr-TR/grafana-scenes.json': return import('../locales/tr-TR/grafana-scenes.json.js');
    case '../locales/zh-Hans/grafana-scenes.json': return import('../locales/zh-Hans/grafana-scenes.json.js');
    case '../locales/zh-Hant/grafana-scenes.json': return import('../locales/zh-Hant/grafana-scenes.json.js');
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
   }
 }
const resources = LANGUAGES.reduce((acc, lang) => {
  acc[lang.code] = async () => await __variableDynamicImportRuntime0__(`../locales/${lang.code}/grafana-scenes.json`);
  return acc;
}, {});
const loadResources = async (resolvedLanguage) => {
  const translation = await resources[resolvedLanguage]();
  return translation.default;
};

export { loadResources };
//# sourceMappingURL=loadResources.js.map
