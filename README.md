# parcel-parcel-parcel

集運小店 · Parcel Point

像素風集運自提點模擬遊戲，支援桌面鍵盤及手機觸控，包含不計時練習與三分鐘班次。

## 線上遊玩

https://jacobmaster-97.github.io/parcel-parcel-parcel/?v=0.4

桌面使用 WASD／方向鍵移動、E 互動、方向鍵及 Enter 選貨、Esc 返回／暫停。手機使用左下搖桿、右下情境按鈕；點選包裹後確認。

## v0.4 訂單及選貨

已確認的像素介面接入：需求卡、分區章、完整編號、耐性狀態及手持欄；選貨卡可單選，有返回、暫停與確認。開架不預選，交貨時才核對，選貨期間繼續計時；暫停與旋轉後保留選件。

客人橫向排隊，長櫃檯分隔公眾與工作區。收貨在右上，紫色寄貨籠改到右下，店員收下寄貨後可直接送入籠。活動門沿用原櫃檯素材。

送貨員持貨到收貨區，卸貨後空手離開。新貨可自由選A/B/C上架；每日三分鐘，收舖後可不限時整理或手動下一天。重新整理仍會重置進度。

商店升級本輪只列開發優先次序，見design/UPGRADE_PRIORITIES.md；購買、錢包與持久存檔尚未實作。

## 開發

需要 Node.js 20+，無需安裝執行期依賴。

```sh
npm start
npm test
npm run build
```

本地網址為 http://127.0.0.1:4173 。`docs/index.html` 是內嵌素材的獨立版，可下載離線開啟。

Pages 使用 main 分支的 /docs 目錄。修改後執行 npm run build，再把 deliverables/parcel-point-prototype-v0.4.0.html 複製到 docs/index.html 並提交，即會重新部署。

Google Sites 可用「插入 → 嵌入 → 網址」加入上方網址，並預留足夠高度；建議同時提供另開視窗遊玩連結。

## 驗證與限制

27 項規則測試、桌面鍵盤及手機模擬觸控流程通過，包括寄貨、送貨員、日結及換日；詳見 QA_REPORT.md。尚待 Android／iPhone 真機與 Google Sites 實際嵌入測試。重新整理會重置進度；工具升級、員工、分店、持久存檔及自取櫃玩法未實作。

角色及場景為 AI 生成並整理的原創素材；部分右向側身鏡像，持貨動畫使用固定紙箱。開發流程使用 GameStudio skill：https://github.com/guangyuspace/codex-gamestudio-skill ，未將該 skill 文件或程式打包至本倉庫。

### v0.3.1

互動浮標移至店員側左方以避開收銀機；新增開啟的活動門圖案；入口加闊一倍並移除出入口浮標。

### v0.3.2
活動門改用原櫃檯貼圖組成，統一地圖畫風，停止使用獨立門素材。
