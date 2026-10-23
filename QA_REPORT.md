# 原型 v0.5.0 驗收紀錄

2026-10-23。範圍：跨日錢包、收支、完整快照、換日前唯一自動保存、恢復與資料轉移；原有美術與玩法回歸。瀏覽器報告及截圖放 deliverables/。

## 規則驗證：43 項 PASS

`npm test`：game.test.mjs 27、finance.test.mjs 8、save.test.mjs 8。涵蓋既有提貨、錯件、自由上架、寄貨預留／跨日、送貨員、暫停及期限；新增即時收入與防重、夜間入帳、結算一次、整數溢位、未來支出／退款基礎、30日封存、完整快照、隊列引用一致、隨機序列、持貨／預留、卸貨前後、不相容／損壞檔拒絕。未加入購買玩法。

## 實際 Chromium 瀏覽器

測試使用同一已打包單檔 file://，儲存後端另在本地 HTTP 原生 IndexedDB 驗證。啟動本地服務 `npm start`，環境備妥 Playwright 後執行：

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node tests/browser-smoke.mjs
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node tests/offline-smoke.mjs
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node tests/ui-smoke.mjs
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node tests/storage-smoke.mjs
```

- 完整鍵盤及純觸控：提貨、錯件／退回、自由上架、右下寄貨一次計酬、送貨員、暫停、日結、不限時整理、手動／自動換日 PASS，JS錯誤0。
- UI：首次接待才揭示需求、無預選、空格停用、暫停及旋轉保留選取、單次確認 PASS；5手機尺寸操作至少48px，保留可見操作。
- 離線5尺寸：無外部請求或JS錯誤；手機換日流程 PASS。
- 錢包／儲存：實際完成首單$15，收支頁顯示$10及$5；收入、暫停、匯出、日結、整理均不建立自動主檔。只於換日前保存第2天初始180秒及$15，重載先暫停，離線十分鐘不推進。
- 實際下載JSON／匯入／取消、備份恢復、無效匯入、新店取消 PASS。整份狀態替換，非合併金額。
- 原生IndexedDB：接管、舊頁拒寫、交易中止保持舊檔、損壞主檔拒絕自動覆寫、保留有效備份及問題檔 PASS。
- 注入保存失敗：停在舊日換日交界，主檔未變；重試只前進一次 PASS。
- 手機觸控換日保存／重載／續玩，以及390×844、844×390、360×640、640×360、360×800收支選單 PASS。橫向長日報可捲動，關閉鍵保持可見；桌面及小橫向截圖已目視。

證據：prototype-browser-report.json、prototype-offline-report.json、ui-integration-report.json、wallet-storage-report.json；wallet-daily-report.png、wallet-save-failure.png、wallet-report-*.png。

## 打包及發布

v0.5.0 HTML／ZIP由工具產生；最終CRC及PLAY-OFFLINE逐byte一致性於發布時再驗證。打包注入使用回呼，避免String.replace把原碼的$$當替換語法而漏顯貨幣符號；已由實際單檔$15斷言驗證。

公開HTTPS互動自動化受本環境代理CA限制，未關閉TLS；發布以Pages built、HTTP200、線上HTML與已測單檔逐byte相同作證。不能把file://互動稱為公開HTTPS互動驗證。

## 未驗證／限制

Android／iPhone真機、Safari儲存差異、安全區、無痕與Google Sites實機、系統直接殺頁、實際容量耗盡、長時間效能及完整讀屏未驗證。已注入原生交易中止／不合法資料／存檔寫入故障，但不等於所有作業系統故障均已覆蓋。手機與電腦不自動同步，本地資料清除需靠下載備份恢復。沒有雲端、防作弊、升級商品或離線收益。
