# parcel-parcel-parcel

集運小店 · Parcel Point

像素風集運自提點模擬遊戲，支援桌面鍵盤及手機觸控，包含不計時練習與三分鐘班次。

## 線上遊玩

https://jacobmaster-97.github.io/parcel-parcel-parcel/?v=0.3

桌面使用 WASD／方向鍵移動、E 互動、方向鍵及 Enter 選貨、Esc 返回／暫停。手機使用左下搖桿、右下情境按鈕；點選包裹後確認。

## v0.3 每日營運

新地圖採用橫向排隊、分隔客人與貨架的長櫃檯，以及右側員工通道。櫃檯浮標顯示「互動」，收貨與紫色寄貨籠位於右上方，A／B／C 貨架在下方。

先到櫃檯接待，才顯示提貨碼及實際貨架提示。新貨可自由選 A／B／C 上架；只有第一天開始時會自動配好初始貨架。

送貨員持貨由入口走到收貨區，放貨後空手離開。部分客人會寄貨：接收包裹後，店員須經通道送到紫色寄貨籠才完成訂單。

每個營業日三分鐘，收舖後按「貨物上架」進入不限時整理。收貨清空後自動開下一天，也可按「下一天」提早開門。手上已接收的寄貨須先妥善處理。貨物位置、收貨餘貨及累計收入在本次遊戲內跨日保留。

## 開發

需要 Node.js 20+，無需安裝執行期依賴。

```sh
npm start
npm test
npm run build
```

本地網址為 http://127.0.0.1:4173 。`docs/index.html` 是內嵌素材的獨立版，可下載離線開啟。

Pages 使用 main 分支的 /docs 目錄。修改後執行 npm run build，再把 deliverables/parcel-point-prototype-v0.3.html 複製到 docs/index.html 並提交，即會重新部署。

Google Sites 可用「插入 → 嵌入 → 網址」加入上方網址，並預留足夠高度；建議同時提供另開視窗遊玩連結。

## 驗證與限制

27 項規則測試、桌面鍵盤及手機模擬觸控流程通過，包括寄貨、送貨員、日結及換日；詳見 QA_REPORT.md。尚待 Android／iPhone 真機與 Google Sites 實際嵌入測試。重新整理會重置進度；工具升級、員工、分店、持久存檔及自取櫃玩法未實作。

角色及場景為 AI 生成並整理的原創素材；部分右向側身鏡像，持貨動畫使用固定紙箱。開發流程使用 GameStudio skill：https://github.com/guangyuspace/codex-gamestudio-skill ，未將該 skill 文件或程式打包至本倉庫。
