// 假的 python（4-b6 的 npm run fonts 測試用；不是測試）。由 b6-font-fixture.js 的 installFakePython() 包成可以直接執行的檔，用 PYTHON 指過去。
// 字型是 b6-font-fixture.js 的 woff2Font() 做的假 WOFF2：private data 區的 note 記著它有哪些字（chars）、哪些可變軸（axes）、哪些軸被固定了（pinned）。
//
// 會的叫法（跟真的 python＋fonttools 一樣）：
//   python -c <程式>                                           結束碼 0（給命令檢查「import fontTools, brotli」用）；-V／--version 印版本
//   python -m fontTools.varLib.instancer <輸入> <軸=值>… (-o <輸出> | --output=<輸出> | --output <輸出>)
//       軸=單一個數（wdth=100）→ 固定那個軸（從 axes 拿掉、記進 pinned）；軸=a:b（opsz=8:64、wght=300:700）→ 那個軸留著、範圍改成 a:b（記在 axes）；字型沒有那個軸 → 結束碼 1。
//   python -m fontTools.subset <輸入> [--unicodes=…] [--text=…] [--text-file=…] [--flavor=woff2] --output-file=<輸出> [其他 --選項]
//       輸出的字 ＝ 輸入有的字 ∩ 要的字（--unicodes 收 U+XXXX、U+XXXX-YYYY、XXXX、0xXXXX、*，逗號或空白隔開；--text-file 的換行不算）。
//       沒有 --flavor=woff2 → 寫出來的檔頭不是 wOF2（像真的一樣寫成 TrueType）。
//   其他叫法 → 結束碼 2。
// 壞法（環境變數）：
//   FAKE_NO=brotli（或 fontTools）       任何叫法都印「ModuleNotFoundError: No module named 'brotli'」、結束碼 1
//   FAKE_FAIL_INSTANCER=GSF              instancer 處理 Google Sans Flex（note.family 是 GSF）時印「ERR-FAKE-42」、結束碼 1
//   FAKE_FAIL_SUBSET=GSF                 subset 處理 GSF 時印「ERR-FAKE-42」、結束碼 1
//   FAKE_NOOUT=GSF                       subset 處理 GSF 時結束碼 0 但不寫輸出
//   FAKE_EMPTY=GSF                       subset 處理 GSF 時寫一個 0 位元組的輸出
// FAKE_LOG=<檔>：每次呼叫附加一行 JSON { argv, step, family, output }。
import fs from 'node:fs';
import { woff2Font, readNote } from '../../b6-font-fixture.js';

const argv = process.argv.slice(2);
const log = (entry) => { if (process.env.FAKE_LOG) fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ argv, ...entry }) + '\n'); };
const die = (code, message) => { process.stderr.write(message + '\n'); process.exit(code); };

if (process.env.FAKE_NO) {
    log({ step: 'missing-module' });
    die(1, `Traceback (most recent call last):\nModuleNotFoundError: No module named '${process.env.FAKE_NO}'`);
}
if (argv[0] === '-V' || argv[0] === '--version') {
    process.stdout.write('Python 3.12.0 (fake)\n');
    process.exit(0);
}
if (argv[0] === '-c') {
    log({ step: 'probe' });
    process.exit(0);
}

function readFont(file) {
    if (!file || !fs.existsSync(file)) die(1, `fake python: 找不到輸入 ${file}`);
    const note = readNote(fs.readFileSync(file));
    if (!note || !note.fake) die(1, `fake python: ${file} 不是字型`);
    return note;
}
const cpsOf = (chars) => [...chars].map((c) => c.codePointAt(0));

if (argv[0] === '-m' && argv[1] === 'fontTools.varLib.instancer') {
    const rest = argv.slice(2);
    let output;
    const specs = [];
    let input;
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '-o' || a === '--output') output = rest[++i];
        else if (a.startsWith('--output=')) output = a.slice('--output='.length);
        else if (a.startsWith('-')) continue;
        else if (input === undefined) input = a;
        else specs.push(a);
    }
    const note = readFont(input);
    log({ step: 'instancer', family: note.family, output });
    if (process.env.FAKE_FAIL_INSTANCER && process.env.FAKE_FAIL_INSTANCER === note.family) die(1, 'fake instancer: ERR-FAKE-42');
    if (!output) die(2, 'fake instancer: 要有 -o <輸出>');
    const axes = { ...note.axes };
    const pinned = { ...note.pinned };
    for (const spec of specs) {
        const [tag, value] = spec.split('=');
        if (!(tag in axes) || value === undefined) die(1, `fake instancer: 沒有這個軸或寫法不對：${spec}`);
        if (value.includes(':')) axes[tag] = value;
        else {
            delete axes[tag];
            pinned[tag] = value;
        }
    }
    fs.writeFileSync(output, woff2Font(cpsOf(note.chars), { note: { ...note, axes, pinned } }));
    process.exit(0);
}

if (argv[0] === '-m' && argv[1] === 'fontTools.subset') {
    const rest = argv.slice(2);
    const input = rest.find((a) => !a.startsWith('-'));
    const opt = (name) => rest.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
    const output = opt('output-file')[0];
    const note = readFont(input);
    log({ step: 'subset', family: note.family, output });
    const is = (key) => process.env[key] && process.env[key] === note.family;
    if (is('FAKE_FAIL_SUBSET')) die(1, 'fake subset: ERR-FAKE-42');
    if (!output) die(2, 'fake subset: 要有 --output-file=<輸出>');
    if (is('FAKE_NOOUT')) process.exit(0);
    if (is('FAKE_EMPTY')) {
        fs.writeFileSync(output, Buffer.alloc(0));
        process.exit(0);
    }
    const want = new Set();
    let all = false;
    for (const list of opt('unicodes')) {
        for (const token of list.split(/[\s,]+/).filter(Boolean)) {
            if (token === '*') { all = true; continue; }
            const m = /^(?:U\+|0x)?([0-9a-f]+)(?:-(?:U\+|0x)?([0-9a-f]+))?$/i.exec(token);
            if (!m) die(1, `fake subset: --unicodes 讀不懂 ${token}`);
            for (let cp = parseInt(m[1], 16); cp <= parseInt(m[2] ?? m[1], 16); cp++) want.add(cp);
        }
    }
    for (const text of opt('text')) for (const c of text) want.add(c.codePointAt(0));
    for (const file of opt('text-file')) for (const c of fs.readFileSync(file, 'utf8')) if (c !== '\n' && c !== '\r') want.add(c.codePointAt(0));
    const chars = [...note.chars].filter((c) => all || want.has(c.codePointAt(0))).join('');
    const out = woff2Font(cpsOf(chars), { note: { ...note, chars } });
    if (!opt('flavor').includes('woff2')) out.writeUInt32BE(0x00010000, 0);
    fs.writeFileSync(output, out);
    process.exit(0);
}

die(2, `fake python: 不會這種叫法 ${JSON.stringify(argv)}`);
