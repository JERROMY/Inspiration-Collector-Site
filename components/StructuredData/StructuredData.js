/**
 * 結構化資料（JSON-LD，規格書 10.5）：一段 <script type="application/ld+json">。
 * 不是程式，是資料；內容是 JSON.stringify 的結果，再把「<」換成轉義寫法 \u003c —— 字裡有 </script> 也跳不出這一段。
 *
 * @param {{ data: object }} props data：要放的 JSON-LD（例如 app/seo.js 的 structuredData）
 */
export default function StructuredData({ data }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
        />
    );
}
