# Vercel 部署：集運小店

此遊戲使用純前端HTML、Canvas及本機存檔，適合Vercel靜態託管。倉庫已加入vercel.json與tools/build-vercel.mjs，匯入後可直接建置；不需要伺服器或環境變數。此輪只準備設定，尚未建立或部署到使用者的Vercel帳號。

## 首次操作

1. 開啟https://vercel.com/new，以GitHub登入Vercel。
2. 在Import Git Repository選擇jacobmaster-97/parcel-parcel-parcel，按Import。若未列出，只需授權Vercel讀取此倉庫。
3. Root Directory用倉庫根目錄「./」，Framework Preset選Other。vercel.json指定Build Command為npm run build:vercel、Output Directory為dist。不要把Root Directory設成docs，也不要改成Next.js。
4. 保持Production Branch為main，按Deploy。
5. 建置完成後以Vercel提供的正式vercel.app網址遊玩。之後推送main會由Git整合自動重新部署；其他分支／PR通常是獨立預覽網址。

若設定頁未自動帶入，可手動填：

| 設定 | 值 |
| --- | --- |
| Framework Preset | Other |
| Root Directory | ./ |
| Build Command | npm run build:vercel |
| Output Directory | dist |
| Environment Variables | 不需要 |

## 保存進度轉站

在原GitHub Pages遊戲「暫停→設定→匯出備份」下載JSON；到Vercel正式網址主選單選「匯入備份」，確認後整份還原，從暫停狀態繼續。新舊網站各有獨立本機儲存，不能自動共用。聲音及文字偏好仍是各網址自己的設定，不隨遊戲備份覆蓋。

之後固定使用正式網址；不同Preview URL／自訂網域亦屬不同來源，不會自動同步本機進度。沒有新增雲端同步或離線收益。

## 建置方式

npm run build:vercel從src及素材重新產生單檔，不依賴可能未同步的docs/index.html。dist/index.html使用同一離線包，音樂與遊戲PNG內嵌；dist/version.json記錄實際版本、schema及SHA256。既有docs/music-preview存在時會一併複製。dist是可重建輸出，每次建置清理，請勿在裡面放手動檔案。

GitHub Pages仍以main /docs服務，本輪隱藏版本標籤亦會更新Pages。Vercel不會自動關閉GitHub Pages；兩個網址可同時保留。倉庫本機dist及.vercel目錄忽略提交。

## 驗證界線與來源

本地建置／瀏覽器及檔案一致性結果見QA_REPORT.md與deliverables/vercel-preparation-v0192。沒有登入或操作Vercel帳號，不宣稱Vercel正式部署已完成。

官方依據（2026-10-27香港查閱）：https://openapi.vercel.sh/vercel.json支持framework:null、buildCommand及outputDirectory；GitHub整合說明https://vercel.com/docs/git/vercel-for-github。成功部署後仍需以使用者實際Vercel網址確認正式載入及存檔匯入。
