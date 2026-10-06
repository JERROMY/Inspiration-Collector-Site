/**
 * publish.js —— 把暫存資料夾裡做好的成品放進輸出資料夾：全部做好才放，不留半成品。
 *
 * 宣傳片與預覽圖（media-run.js）、字型（fonts-run.js）、圖片（images-run.js）都走這一支。
 */
import fs from 'node:fs';
import path from 'node:path';

const PARTIAL = '.partial';
// 放進輸出資料夾失敗時，常見的 errno 說成白話；沒列的附原文
const PUT_REASONS = {
    EEXIST: '這個位置是檔案，不是資料夾',
    ENOTDIR: '這個位置是檔案，不是資料夾',
    EACCES: '沒有寫入權限',
    EPERM: '沒有寫入權限（檔案被別的程式佔著時，Windows 也會是這個錯）',
    EBUSY: '檔案被別的程式佔著',
    EISDIR: '同名的位置被資料夾佔住',
};

/**
 * @param {string} file 路徑
 * @returns {boolean} 是不是存在的資料夾
 */
function isDirectory(file) {
    return fs.statSync(file, { throwIfNoEntry: false })?.isDirectory() === true;
}

/**
 * 把暫存資料夾裡的成品放進 out。先確認每個目標名字都不是資料夾（是就整個不動）；再全部複製成 out 裡的 <名字>.partial，
 * 複製階段失敗（磁碟滿、沒有權限）就把 .partial 清掉，out 裡原有的檔不動；複製都成功才一個一個改成正式名字，最後刪掉 remove 列的舊檔。
 * 改名階段失敗（外部程式佔著檔案，Windows 的 EPERM／EBUSY）會清掉剩下的 .partial，但已經改好的是新的、其餘還是舊的，可能半新半舊，重跑即可。
 *
 * @param {string} tmpDir 暫存資料夾
 * @param {string} out 輸出資料夾（不存在會建，含中間的資料夾）
 * @param {string[]} names 要放的檔名（都在 tmpDir 底下）
 * @param {string[]} [remove] 放好之後要從 out 刪掉的舊檔名（不存在就略過）
 * @throws {Error} 「放進 <out> 失敗：原因」，常見的 errno（EEXIST、ENOTDIR、EACCES、EPERM、EBUSY、EISDIR）說成白話，其餘附原文
 */
export function publish(tmpDir, out, names, remove = []) {
    const targets = names.map((name) => path.join(out, name));
    const staged = targets.map((target) => target + PARTIAL);
    const touched = [];
    try {
        fs.mkdirSync(out, { recursive: true });
        const blocked = targets.find(isDirectory);
        // 跟改名時撞上資料夾是同一個錯，走同一套說法，只是提早、在動任何檔之前發現
        if (blocked) throw Object.assign(new Error('目標名字是資料夾'), { code: 'EISDIR', path: blocked });
        names.forEach((name, i) => {
            touched.push(staged[i]);
            fs.copyFileSync(path.join(tmpDir, name), staged[i]);
        });
        staged.forEach((partial, i) => fs.renameSync(partial, targets[i]));
        for (const name of remove) fs.rmSync(path.join(out, name), { force: true });
    } catch (err) {
        for (const partial of touched) fs.rmSync(partial, { force: true });
        const known = PUT_REASONS[err.code];
        // copyfile 失敗時 err.path 是來源（暫存資料夾裡的檔）、err.dest 才是寫不進去的地方；訊息裡不放暫存資料夾的路徑
        const message = `放進 ${out} 失敗：${known ? `${known}（${err.dest ?? err.path ?? out}）` : err.message}`;
        throw new Error(message.split(tmpDir).join('<暫存資料夾>'), { cause: err });
    }
}
