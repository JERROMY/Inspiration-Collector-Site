/**
 * tools.js —— 叫外部工具（ffmpeg、cwebp、python）時共用的小東西：判斷工具開不開得起來、把失敗原因說成一句話。
 *
 * 工具由呼叫端傳進來的 run 執行（命令用 spawnSync，回傳 { status, stdout, stderr, error }；也可以是 Promise），
 * 所以這裡不需要為了測試開任何後門。
 */

const REASON_LIMIT = 600;

/**
 * @param {{ status: number | null, signal?: string | null, stdout?: string, stderr?: string }} res run 的回傳（工具開得起來、但結束碼不是 0）
 * @returns {string} 工具為什麼沒成功：講 stderr（沒有就講 stdout 或結束碼），最多 600 字
 */
export function reasonOf(res) {
    const text = String(res.stderr ?? '').trim() || String(res.stdout ?? '').trim();
    return (text || `結束碼 ${res.status ?? res.signal}`).slice(0, REASON_LIMIT);
}

/**
 * 工具開不起來（spawn 就失敗）就丟錯；找不到檔案講白話，不露 errno 原文。
 *
 * @param {{ error?: Error }} res run 的回傳
 * @param {string} name 工具名（ffmpeg、cwebp、python）
 * @param {string} command 試的路徑或指令
 * @returns {object} 原來的 res（開得起來的話）
 * @throws {Error} 開不起來；訊息是「<工具> 跑不起來：找不到 <工具>（試的是 …）」或「<工具> 跑不起來（試的是 …）：原文」
 */
export function launched(res, name, command) {
    if (!res.error) return res;
    if (res.error.code === 'ENOENT') throw new Error(`${name} 跑不起來：找不到 ${name}（試的是 ${command}）`, { cause: res.error });
    throw new Error(`${name} 跑不起來（試的是 ${command}）：${res.error.message}`, { cause: res.error });
}

/**
 * @param {(command: string, args: string[]) => any} run 執行外部工具
 * @param {string} name 工具名（寫進錯誤訊息）
 * @param {string} command 工具的路徑或指令
 * @throws {Error} `<command> -version` 開不起來（找不到、沒權限…）或結束碼不是 0；訊息有工具名、試的路徑與原因
 */
export async function checkTool(run, name, command) {
    const res = launched(await run(command, ['-version']), name, command);
    if (res.status !== 0) throw new Error(`${name} 跑不起來（試的是 ${command}）：${reasonOf(res)}`);
}
