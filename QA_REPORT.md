# v0.18.0 暫停設定：驗收通過

四項設定全部在暫停子選單：獨立BGM／SFX開關及音量、標準／大字、集中匯出匯入及成功保存時間。設定返回仍暫停，偏好獨立本機記住；遊戲schema10與唯一換日前自存保留。

121／121規則測試PASS，含新增5項偏好預設／資料驗證／獨立鍵／重載／儲存拒絕。settings-smoke六尺寸PASS（1280×1000、390×844、360×640、640×360、720×1280、1080×2400）：大字、48px操作、固定返回、計時／錢包／手持不動、沒有額外IDB寫入、下載JSON、壞檔保留／取消／確認取代、成功保存時間、reload偏好、拒絕偏好保存後本頁可用。

WebAudio實際Gain驗證：音樂關閉時SFX1%對應Gain0.01、SFX關閉時不生成oscillator而BGM可播放；靜音bus在active probe下Gain0。原生閒置GainNode不處理AudioParam讀值的行為已隔離重現，詳DEBUG；沒有為測試改玩法或停用靜音。music-smoke原有五組解鎖／兩曲／暫停／延遲解碼／舊靜音／API失敗PASS。

完整鍵盤及純觸控提貨錯件／退回／寄貨／上架／送貨員／碰撞／夜間及換日PASS；storage原生IndexedDB匯入／備份／故障原子中止／重試／所有權及手機續玩PASS。offline五尺寸零外部請求及換日PASS。另透過真實暫停設定選大字後跑ui-smoke，五手機尺寸選貨／旋轉／保留選取／暫停成就往返／取消／確認取件均PASS，主按鈕可見且≥48px。

報告deliverables/settings-v018/browser-report.json、large-ui/ui-integration-report.json及既有music-integration-report.json、wallet-storage-report.json、prototype-browser-report.json、prototype-offline-report.json。UI_AUDIT.md及相關截圖已目視。

真機iPhone／Android／Safari、讀屏、實際OS音量及持續效能UNVERIFIED。設定保留目前瀏覽器，不隨遊戲備份覆蓋；無帳號雲端同步。

# v0.17.0 三款新客人：驗收通過

116／116單元PASS；新客人三款×提貨／寄貨×桌面／手機觸控12實際路徑PASS。確認正確idle頭像、空手／持箱四向圖集載入及實際離場動畫，寄貨接收不入帳、提貨只入一次帳，完整JSON匯入保留外觀，離線無外部請求。

9圖集204格，32×48cell及腳底44，全部步行各方向8個不同影格；最近鄰縮放、透明留白、無可見綠幕主導像素PASS。三款與舊三款並排及桌面／手機實際截圖已目視。報告deliverables/customers-v017/asset-report.json及browser-report.json。

完整keyboard／pure-touch提貨、錯件／退回、上架、寄貨、送貨員、碰撞閘口、營業／不限時夜間及換日PASS；最後去綠邊後重跑新客人12路徑、storage-smoke原生IndexedDB故障／原子中止／備份／匯入／擁有權／續玩，以及offline-smoke五尺寸與零外部請求PASS。後一次只改PNG，不改JS；完整玩法回歸沿用同一JS版本結果。

schema10支援1–9，新舊客人ID保留，非法外觀拒絕。經濟及音樂不改，營業120秒／基礎耐性60秒，唯一換日前自存。真機iPhone／Android／Safari、喇叭聽感及長時效能UNVERIFIED。設定仍只有提案。

# v0.16.0 背景音樂

已按確認接入營業及整理兩曲。Web Audio共用一個Context，主動操作後才播放；營業、關店／升級／上架按階段切換，暫停／主選單／背景／換日保存停止，恢復時續播。音樂失敗不阻擋遊戲。兩首內嵌離線單檔，與已確認MP3逐byte相同。設定目前只有提案，沒有新增設定UI／HUD或保存時點；schema9不變。詳design/music-integration-v1/IMPLEMENTED.md及design/settings-v1/PROPOSAL.md。

# v0.15.2 移除練習模式

依使用者要求，移除練習按鈕、練習完成視窗、跳轉及前端練習流程。新店直接開始120秒正式營業，舊店繼續經營與收舖不限時上架保留。前端所有UI、啟動、日結、成就及匯出均只走正式流程。schema9與唯一換日前保存不變。詳design/PRACTICE_REMOVAL_IMPLEMENTED.md。

# v0.15.1 收支日報簡化

依使用者要求，只顯示當日摘要，移除歷史營業日下拉、逐筆明細、退款欄及歷史明細合併提示。保留當日收支、資金與工作統計。財務、成就及遊戲規則不改，schema9與唯一換日前自存不改。實裝及驗證見design/FINANCE_SUMMARY_IMPLEMENTED.md與tests/finance-summary-smoke.mjs。

# v0.15.0 成就系統

已實裝修訂清單30項成就與30款像素徽章，C區成就只有購入一階段。未達成只顯示通用問號，達成首階才顯示專屬圖示。主選單／暫停／收舖摘要三入口，保持原入口返回及暫停；依最新要求不顯示狀態／分類欄。沒有新增營業HUD、數值獎勵或自動領取操作。

schema9支援1–8完整遷移；舊檔不補造提寄貨與玩家／AI上架歷史，只回認可靠設備／收入。仍只在換日前連同錢包貨物保存，失敗重試不重計。

驗證：111／111規則測試、30圖格透明留白及唯一性、成就五尺寸／三入口／鎖定隱私／返回焦點／換日及JSON恢復通過。原有鍵盤／純觸控、五尺寸選貨（含成就往返）、原生IndexedDB故障／擁有權、手機16版面及五尺寸離線回歸通過。真機Android／iPhone／Safari、讀屏與長期平衡未驗。詳design/achievements-v1/IMPLEMENTED.md、UI_AUDIT.md與deliverables/achievements-browser-report.json。

# v0.14.0 手機全圖介面（2026-10-25香港）

使用者已確認只設全圖：精簡48＋64px頂部、完整自動縮放地圖、獨立操作區、按需工作詳情；沒有近看入口。桌面與schema8／經濟／保存規則保留。95項單元、16版面、完整鍵盤／觸控玩法、五尺寸選貨及離線與原生存檔回歸PASS。真機未新增驗證。詳design/mobile-layout-review-v1/IMPLEMENTED.md。

# v0.13.0 貨物管理系統與耐性（2026-10-25香港）

新來客基礎耐性60秒；優惠36／退貨48／天氣60。工具新增一次性$900「貨物管理系統」，恢復地圖及接待後提貨／選貨區名。schema8保留舊1–7進度；只換日前自存。95項規則、六視窗購買／提示／保存回歸PASS；原生存檔及事件回歸PASS。真機未新增驗證。詳design/CARGO_MANAGEMENT_IMPLEMENTED.md。

# v0.11.0 關店補貨／尋貨／進階理貨員（2026-10-24）
正式新增：每次關店在手持／員工貨物退回後補滿收貨籠實際容量（6–12格），只補新空位、不重設舊貨或格位。重開摘要／讀檔不補第二次，沒有附帶入帳。夜間仍無限時，滿架可手動下一天保留未上架貨。
新來客基礎耐性45秒；事件倍率照舊，因此優惠27秒／退貨36秒／正常及天氣45秒。已保存客人維持原耐性，不讀檔重置；既有小費公式不變，所以正常新客最高小費4。
每次到店嘗試25%機率選2–5人（四個數量等機率），否則1人；同一批同時生成，仍須有可服務包裹／寄貨格，隊列總上限5，不預支或積欠超額。
遊戲地圖／接待後訂單／貨架選貨／手持文字不再顯示A/B/C/D區名，也不以箭頭透露正確貨架；格號與提貨碼保留，讓玩家逐架找。購買／員工分區管理仍可使用區名，內部貨物zone與格位未刪除。
使用者已確認：一次性投資$180解鎖進階理貨員；之後每天選$85／速度95或原$60／速度88，只聘一位、互斥排班。預留薪金按所選方案，翌日開門扣一次，可取消未開始排班，不自續。解鎖／級別／排班保存在schema7，支援1–6；舊進度預設未解鎖與普通店員，不改金錢／貨位／事件。
NPC對白只在design/NPC_DIALOGUE_PROPOSAL.md提出20句及顯示規則，尚未接入runtime，需使用者確認。

# v0.10.1 最終調整（2026-10-24）
每營業日120秒；工作鞋內部效果96且UI無實際移速數字；理貨員預設88。普通到店嘗試5–9秒均7秒、首輪7秒（首客即時），最多5人，橫列站位174/140/106/72/38。優惠間隔3.333–6秒均4.667；退貨4.545–8.182均6.364；天氣5–9秒均7。仍受可服務貨物與寄貨空間限制，不造無貨訂單。
事件平常／其他各50%，其他符合舊門檻者均分。schema6支援1–5：舊時間只在schema<5比例換算一次；schema5不重縮時間或重抽。5人隊列加1件已接收手持寄貨的6份有效訂單／預留可完整保存，舊<=4人的存檔可載入。保留僅換日前自存。

# 原型 v0.10.0 驗收紀錄

v0.10：75項規則測試通過，包含30,000種子二階段分布（正常約50%、其餘約1/6）、符合限制過濾、schema4真舊演算法預告保留、120秒比例換算／保存再讀不重縮、顧客耐性與派客計時不變。工作鞋效果96／到期80，升級頁以文字顯示步伐，不顯示實際移速數字。

新版四事件預告／JSON／故障重試／重載／五手機視窗、原生存檔／備份／擁有權流程已通過。實體Android／iPhone／Safari尚未驗。下方歷史測試結果不代表新版本重跑。

## v0.9 美術接入
- npm test：72/72 PASS，遊戲規則及經濟測試不因貼圖替換改動。
- art-smoke：桌面1440×1000、手機390×844／844×390，從schema4完整檔載入玩家與持貨理貨員；錢包、貨物預留及事件一致；A區8格及C/D擴充仍顯示；繪圖實際使用player/worker獨立圖集、interior tiles、counter repeat、gate與decor overlay。無舊clerk圖集繪圖、無裝飾新目標。畫面已目視。
- offline-smoke：五手機尺寸、純離線、無外部請求、操作≥48px及不限時整理PASS。
- storage-smoke：原生IndexedDB、只換日前保存、匯出匯入、完整恢復、壞主檔與有效備份、原子故障及多分頁擁有權PASS。
- upgrade-smoke：v0.5檔遷移、購買／薪金、舊完整進度保存、故障重試與五手機尺寸PASS。
- 工作動作修正：首次問提貨碼只接待，不播放含包裹的放貨格；寄貨客接收採pickup，交貨／存籠才place。所有金額仍由原規則層決定，沒有音效／動畫派錢。
- 實機Android／iPhone／Safari、長時間效能與讀屏仍未驗；自動化為Chromium模擬。

---

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

## v0.6新增升級驗收

規則總數54：既有43，加upgrades.test.mjs 11項。驗證鞋三日效期／不疊加、每區獨立擴容、D區、貨籠12格上限、薪金預留／扣款一次／不續聘、取消排班、AI沿路碰撞／讓行／排除已選貨／持貨存取／收舖退回、D下排路線與舊版遷移。

upgrade-smoke.mjs實際瀏覽器由測試用有資金v0.5存檔匯入，驗證取消／確認、鞋／A架／D架／兩籠／店員、優先序、購買不自存、換日失敗後重試、薪金及投資分類、schema2重載暫停、員工手持JSON匯出，以及零收貨先詢問。測試資金為明示fixture，正常賺錢已由完整玩法／storage-smoke驗證，正式遊戲沒有發放測試金錢入口。

桌面及390×844、844×390、360×640、640×360、360×800升級頁觸控購買與換日通過。小橫向採左側資金／完成、右側分類／捲動卡片，關閉／完成／分類操作≥48px且在viewport。整理期頂列隱藏品牌，保留時間／升級／下一天／暫停避免超界。

報告upgrade-browser-report.json；截圖upgrade-tools-desktop.png、upgrade-shelves-desktop.png、upgrade-expanded-map.png、upgrade-save-failure.png、upgrade-*.png。桌面地圖及小橫向已目視。原圖像素材未重生成；新增層架以原貨架像素呈現，員工沿用原店員圖集加胸牌。

分店／自取櫃依指定暫緩，自動提貨店員、特殊單及獨立擴建未加入。真機、Safari及實際經濟平衡仍未驗證。發布狀態以CODEX_HANDOFF.md及github-publication-status.json為準。

## v0.7範圍與驗收

營業150秒；新店AB兩區，C購買解鎖；收貨籠右上移位與相應碰撞／互動／NPC路線；隨機事件只有文字框架，未改正式來客頻率。

規則總數61：既有54＋shop-revision.test.mjs 7。新增精確150秒收舖、AB初始貨物／空C地板可走、C $320解鎖及$480/$650擴層、收貨點／碰撞／送貨員卸貨一次、schema2舊C貨物保留與時間換算、未卸貨舊送貨員改道／已卸貨不重送、舊玩家新籠重疊安全移位及損壞座標拒絕。

shop-revision-smoke.mjs實際單檔驗證新店AB、150秒前後狀態、C購買確認、鍵盤到右上取貨並上C、最後一件上架自動保存換日。另重跑升級、UI、離線五尺寸、原生存檔及完整鍵盤／觸控回歸。完整流程的AB滿架情境改驗未上架貨跨日保留，自動換日另由專項驗證。報告shop-revision-browser-report.json；截圖shop-ab-upper-receiving.png／shop-c-purchased.png。

舊腳本曾硬寫初始ABC、首件收貨5048、180秒及舊收貨座標，已按新規則更新；沒有為了舊測試還原被移除的C或偷偷增加架位。真機／Safari／經濟平衡仍未驗證，隨機事件未實裝。

- 補充安全驗收：從未建C範圍(210,310)開商店購買C，角色連同原狀態移至(210,260)，之後可實際走到新收貨點、上架及自動換日，避免新增貨架造成困住。

## v0.8事件驗收

規則總數72：原61＋day-events.test.mjs11。涵蓋四事件及權重、1–3日保護／連忙限制、獨立seed穩定抽選、各類計時與耐性、退貨潮分類頻率、練習隔離、夜間無新客、完整快照／舊schema3正常過渡、不合法事件拒絕、隊滿／籠滿不積欠或多派送貨員。

day-events-smoke.mjs實際單檔：四種事件預告及百分比、十分鐘夜間不變、重開商店不重抽、實際JSON下載含預告、不新增中途自存、注入保存故障後重試同一事件／計時、重載暫停且計時不再除、離線不走，均通過。事件fixture為有效可重現店舖進度，正式無選事件或發錢QA入口。

五手機尺寸390×844／844×390／360×640／640×360／360×800觸控預告→商店→上架→保存啟用通過；預告倍率文字、升級／跳過及完成按鈕可見，操作≥48px。小橫向原本倍率藏在捲動下方，已改左右欄並新增邊界斷言。桌面預告、啟用暫停、直向及小橫向截圖已目視。

證據day-events-browser-report.json；event-sale/normal/weather/returns-forecast.png、event-active-pause.png、event-prompt-*.png及event-shop-*.png。完整玩法、舊升級、存檔、選貨UI及離線回歸另驗；Pages採built／HTTPS200／已測HTML逐byte一致，公共HTTPS互動仍受代理CA限制，未關TLS。真機／Safari／經濟平衡未驗證。

最終78/78單元PASS；新增普通首輪7秒／隨機中點7秒、理貨員0.1秒走8.8距離與五人隊列加手持寄貨完整往返。實際桌面／直橫手機從5人fixture載入並顯示5個角色PASS，四事件預告與五手機保存／重載PASS。

v0.11驗收：82項單元PASS；新增批次2/3/4/5、上限／唯一貨品、45秒、擴容後補滿不重複、不發錢、解鎖一次／85預留／取消／95速度／普通續聘及保存完整性。operations-smoke桌面／直橫手機實際購買／扣85／重載tier、收貨6滿格與隱藏區名選貨PASS；相關截圖已目視。真機及長期經濟平衡未驗證。
# v0.12 NPC對白驗收

90/90單元PASS。三角色×桌面／直向／橫向單檔實際說話，字級、角色可見、viewport及rect無遮擋、暫停凍結、匯出無speech欄位PASS；截圖已目視。普通擁擠位置可能沒有空位，按設計安靜，未放寬碰撞或縮字。獨立亂數不改Shift／存檔的完整對照PASS；狀態過濾涵蓋持貨折返不說完成、低耐性不說不急、保留目的格不說無位。operations及事件五手機回歸PASS。實機與讀屏未驗；完整紀錄design/NPC_DIALOGUE_IMPLEMENTED.md。

