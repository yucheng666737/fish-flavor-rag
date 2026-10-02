# Windows 本機展示

本專案供下載後本機執行，不提供公開線上服務。GitHub 與分享用 ZIP 不含任何 API 金鑰、.env 或私人索引。每位使用者需使用自己的 OpenAI／Pinecone 帳號與額度。

## 你目前的電腦

雙擊專案目錄內的 `FishFlavorDemo.exe`，按「啟動展示」。它會讀取旁邊既有 `.env`，啟動只監聽 127.0.0.1 的 Node 服務並開啟預設瀏覽器。啟動器使用自動分配的連接埠，不會與原來的 3000 衝突。「停止展示」或關閉視窗只會停止這次啟動的程序。

## 分享可攜版給別人

1. 完整解壓 `FishFlavorDemo-win-x64.zip` 到可寫入的資料夾，保留 `app` 與 `runtime`，不要只取出 exe。
2. 雙擊 `FishFlavorDemo.exe`，按「開啟設定」。首次會從 `.env.example` 建立執行檔旁的 `.env`，用記事本開啟。
3. 填入自己的 `OPENAI_API_KEY`。使用 Pinecone 時設 `RAG_STORE=pinecone`，填自己的 `PINECONE_API_KEY` 與 `PINECONE_INDEX`，索引需為 dense、1536 維、cosine。詳見 app/PINECONE.md。只想使用 OpenAI 與本機索引可保留 `RAG_STORE=local`。
4. 儲存後按「匯入知識」。會詢問是否將知識傳至所選雲端服務並使用 API 額度；首次建立資料才需要匯入。自己的 Pinecone 已有相同版本知識時可略過。
5. 按「啟動展示」。無金鑰時仍能查看頁面與互動設計，但不會假造 AI 回答。

可攜版包含 Node.js Windows x64 執行環境與 npm 依賴，不需另裝 Node、PostgreSQL 或 Docker。啟動器使用 Windows .NET Framework 4.x／Windows Forms；適用已具備該元件的 Windows 10/11 x64。這是「exe 啟動器＋旁邊的程式資料夾」，不是把所有內容塞入一個 exe。

AI 問答需要網路。關閉視窗會停止服務；匯入中關閉則中止本次匯入，之後可重跑。修改設定後請停止並重新啟動展示。匯入使用者自己的 Pinecone 時，不會幫忙訂閱方案、建立索引或刪除既有資料。

## 從原始碼重建

在 fish-rag 目錄、已安裝 Node.js 22.14+ 與 npm 的 Windows 執行：

```powershell
./desktop/build.ps1
```

建置使用系統 .NET Framework 的 csc 編譯器，不下載執行器。依 package-lock.json 執行 `npm ci --omit=dev --ignore-scripts`。只複製明列的程式與 knowledge/demo，不複製 .env、.data、knowledge/private、artifacts 或 baseline。輸出至 dist/build-時間/FishFlavorDemo，並在專案根目錄產生供本人使用的 exe。建置會掃描已知金鑰、檢查私密路徑，使用內附 Node 與空白設定完成啟停及 HTTP 驗證後才建立 ZIP；dist 與 exe 已 Git 忽略。

請分享剛建置的原始 ZIP，不要把已填入自己 .env 的展示資料夾重新壓縮送人。

Node.js 授權與第三方聲明放在 runtime/NODE-LICENSE.txt，npm 套件授權保留在各套件目錄。原專案圖片的再散布權利仍需由專案持有人確認。此 exe 尚未購買程式碼簽章憑證。
