import path from 'node:path';
import { readContent } from '../../lib/content.js';
import Hero from '../../components/Hero/Hero.js';
import Where from '../../components/Where/Where.js';
import How from '../../components/How/How.js';
import Features from '../../components/Features/Features.js';
import ForAI from '../../components/ForAI/ForAI.js';
import Privacy from '../../components/Privacy/Privacy.js';
import Tutorial from '../../components/Tutorial/Tutorial.js';
import Devices from '../../components/Devices/Devices.js';
import News from '../../components/News/News.js';
import Changelog from '../../components/Changelog/Changelog.js';
import Faq from '../../components/Faq/Faq.js';
import Author from '../../components/Author/Author.js';
import Final from '../../components/Final/Final.js';
import styles from './page.module.css';

/**
 * 三語頁的內容：03 首屏、04 能用在哪裡、05 三步驟、06 能收什麼、07 為 AI 做的、08 隱私、09 教學影片、10 支援裝置、11 最新公告、12 更新紀錄、
 * 13 常見問題、14 作者與社群、15 最後的安裝（16 頁尾在 <main> 外面，見 layout.js）。
 * 產生網頁時讀 content/（只在伺服器端跑，不送到瀏覽器）；寫壞的條目由各區自己畫「讀不到」。
 * <main> 是「跳到主要內容」與「關掉公告之後」焦點去的地方：tabindex="-1"（程式可以把焦點放上來，Tab 不會停），不畫焦點框。
 *
 * @param {{ params: Promise<{ lang: 'zh' | 'en' | 'ja' }> }} props
 */
export default async function LangPage({ params }) {
    const { lang } = await params;
    const content = await readContent(path.join(process.cwd(), 'content'));
    return (
        <main className={styles.main} id="main" tabIndex={-1}>
            <Hero lang={lang} />
            <Where lang={lang} />
            <How lang={lang} />
            <Features lang={lang} />
            <ForAI lang={lang} />
            <Privacy lang={lang} />
            <Tutorial lang={lang} />
            <Devices lang={lang} />
            <News lang={lang} slot={content.news[lang]} />
            <Changelog lang={lang} slot={content.changelog[lang]} />
            <Faq lang={lang} />
            <Author lang={lang} links={content.links} />
            <Final lang={lang} />
        </main>
    );
}
