# Pinecone 雲端向量資料庫

不需要安裝 PostgreSQL、Docker 或 Pinecone SDK。本專案使用 Node 內建 fetch 呼叫固定版本 2025-10 的 Pinecone REST API；OpenAI 仍負責 embedding 與生成。

## 帳號與索引

1. 到 https://app.pinecone.io 登入，選 Starter 免費方案。
2. 建立 `fish-flavor-rag` 索引：自行提供向量（Bring your own vectors），dense，1536 維，cosine。雲端與區域選 Starter 允許的選項。不要選內建 embedding 模型，現有資料使用 OpenAI text-embedding-3-small。
3. 在同一個專案建立具有索引描述、讀取、寫入權限的 API key，不需要組織管理權限。
4. 在本機 `.env` 填入 `PINECONE_API_KEY`；`PINECONE_INDEX=fish-flavor-rag`、`PINECONE_NAMESPACE=fish-rag`。切換前保留 `RAG_STORE=local`。

真實金鑰不能貼到聊天、前端、URL、命令列參數或 Git。程式不會自動建立付費方案或索引，也不會自動刪除雲端資料。

## 遷移既有向量

在 fish-rag 目錄執行：

```powershell
npm.cmd run pinecone:migrate
npm.cmd run verify:pinecone
```

第一個指令驗證 `.data/index.json` 的模型、文件指紋、原文與維度，將現有向量連同文字上傳，不會呼叫 OpenAI 重新 embedding。逐筆讀回核對完成後才寫入完成標記，支援安全重跑。第二個指令使用真實 Pinecone 與 OpenAI 驗證雲端檢索、health、風味、營養與飲用區塊，會產生少量 API 用量。

成功後把 `.env` 的 `RAG_STORE` 改為 `pinecone`，重新啟動 `npm.cmd start`。`/api/health` 必須顯示 `storage: "pinecone"`、`status: "ready"`。雲端錯誤會明確報錯，不會偷偷退回 JSON 或模擬回答。

## 新機器或更新文件

若雲端已經有相同文件與模型的資料，只要設定 `.env`、`RAG_STORE=pinecone` 就可啟動，不需要本機 index.json。若第一次建立或文件有變更，執行 `npm.cmd run ingest`，將目前文件經 OpenAI 產生 embeddings 後上傳 Pinecone。`npm.cmd run ingest -- --dry-run` 僅檢查本機文件。

## 儲存內容與版本隔離

每筆 Pinecone record 的 `id` 是文件片段 ID、`values` 是向量、`metadata` 包含 `text`、`source`、`title`、`chunk`、`model` 與 `corpusHash`。原文可以在 Pinecone Console 檢視。每個 namespace 額外包含一筆完成標記，因此 30 個知識片段會顯示 31 筆 records；查詢用 `kind=chunk` 排除此標記。

namespace 由設定前綴、文件指紋及模型名稱產生。變更文件／模型會寫入新的 namespace，舊內容不會混入新查詢。舊 namespace 保留，會占用容量，確認不再需要後再自行從 Console 刪除。這是版本隔離，不宣稱 Pinecone 支援跨紀錄 ACID 交易。匯入後有短暫 eventual consistency，工具會有限次重試讀回；超時可稍後重跑。

查詢由 Pinecone 執行 cosine similarity、來源 filter 與 Top K；後端接收 metadata.text，核對本機相同版本文件後才送入生成。營養區塊仍直接呈現檢索到的已查核摘要。前端維持隱藏引用來源。

## 安全與驗證範圍

- API 金鑰只在後端讀取；Pinecone 主機由固定 control-plane 查得，限制 HTTPS 的 pinecone.io 子網域，禁止重新導向。錯誤不回傳原始 upstream body 或金鑰。
- 知識文字與向量會儲存在 Pinecone 雲端；問題向量會送到 Pinecone。問題與檢索片段會送到 OpenAI。
- `.env`、`.data/`、測試 artifacts 均不提交 GitHub；公開知識文件與遷移工具可提交。
- `npm test` 的 Pinecone 測試使用明確的協定替身，不能作為真實雲端連線成功的證據；實際結果以 `verify:pinecone` 為準。

官方參考：[Upsert](https://docs.pinecone.io/reference/api/2025-10/data-plane/upsert)、[Query](https://docs.pinecone.io/reference/api/2025-10/data-plane/query)、[Pricing](https://www.pinecone.io/pricing/)。
