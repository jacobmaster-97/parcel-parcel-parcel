# v0.17 三款新客人

本次依使用者要求製作並接入實際可用像素圖集。保留原年輕街坊、上班族、銀髮街坊，新增黃衫學生（蓬鬆棕髮、圓眼鏡、背包）、藍帽街坊（短髮、淺藍外套）、酒紅背心伯伯（銀髮、小鬍子）。合共六款。

## 圖集及來源

每款有空手步行、持箱步行、四方向站立三張PNG。步行每方向8影格，方向列依序下／左／右／上；32×48 cell、256×192步行atlas、128×48站立atlas、腳底錨點(16,44)、nearest。共9圖集204格：192步行＋12站立。每列8個影格皆不相同，留白及腳底已驗證。

六張原始稿由image_gen生成，放assets/raw/customers-v017；提示及來源記於metadata/customers-v017-generation.json及customers-v017-carry-generation.json。tools/normalize-new-customers.py依實測輪廓行列裁切，綠幕去背、最近鄰縮放及組圖，沒有把原稿假設為平均等格。每方向空手／持貨共用比例。Pillow/numpy僅用於量測及QA，ImageMagick整理既有生成圖像。PNG8位優化後decoded RGBA逐byte一致。預覽在assets/previews/customers-v017。

## 遊戲接入

src/customers.js為唯一外觀目錄；appearance 0–2保持原角色，3–5為新增角色。使用現有訂單序號循環選外觀，由mod3改mod6，不額外消耗遊戲亂數。只增加外觀；客流、價錢、耐性、對白及角色速度沿用既有規則。所有六款均可提貨或寄貨，沒有新職業屬性。

寄貨客持箱入店、接收後空手離店；提貨客空手入店，正確交付後持箱離店。側面箱子與手部、背面遮擋均已在來源檢查。訂單頭像使用各自站立圖，手機仍維持全圖及獨立操作，不新增HUD。

## 保存及回復

schema10支援schema1–9。沒有新增經濟欄位或重配貨；舊appearance0–2、時間、接待狀態、亂數、錢包及手持均保留。新檔只擴充appearance合法值0–5，訂單／隊列／離場角色都驗證；超界拒絕完整檔案，不靜默換成預設客人。

只有換日前自動保存；圖集載入與看見新角色不另存。匯出完整JSON保留新角色。舊程式無法讀schema10；回退舊網站時須配對更新前備份，不能把新進度降格混合。

## 驗證

見QA_REPORT.md目前版本段及deliverables/customers-v017/asset-report.json、browser-report.json。新增單元覆蓋目錄穩定、實際生成六款、RNG不消耗、舊schema9完整還原及錯誤appearance拒絕。瀏覽器使用實際匯入與E／觸控操作，三款×提寄貨×桌面／觸控共12路徑，驗證正確圖集／持貨狀態／收入及離線無請求。

真機Android／iPhone／Safari、主觀長期動畫觀感仍待實際試玩；不以Chromium觸控模擬宣稱真機通過。設定功能仍只有提案。
