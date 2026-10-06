import { getString, getPlainString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import styles from './LangSwitch.module.css';

// 網址的語言 → hreflang 與 lang 的寫法
const LANGS = [
    { code: 'zh', htmlLang: 'zh-Hant' },
    { code: 'en', htmlLang: 'en' },
    { code: 'ja', htmlLang: 'ja' },
];

/**
 * LangSwitch —— 語言切換：中／EN／日三段，目前那段實心（規格書第 6 節）。每段 44×44。
 * 伺服器端元件（字從字串表取）。點了之後把錨點帶過去、記住選的語言，是 public/nav.js 做的（認 data-lang）；
 * 沒有 JS 時就是一般的連結。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', className?: string }} props lang：目前這一頁的語言
 */
export default function LangSwitch({ lang, className }) {
    return (
        <div className={[styles.lang, className].filter(Boolean).join(' ')} role="group" aria-label={getPlainString(lang, 'lang.label')}>
            {LANGS.map(({ code, htmlLang }) => (
                <a
                    key={code}
                    href={`/${code}/`}
                    hrefLang={htmlLang}
                    lang={htmlLang}
                    aria-label={getPlainString(code, `lang.${code}.name`)}
                    aria-current={code === lang ? 'page' : undefined}
                    data-lang={code}
                >
                    <Seg text={getString(lang, `lang.${code}.short`)} />
                </a>
            ))}
        </div>
    );
}
