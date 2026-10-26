# v0.16 背景音樂

`audio/business.mp3`／`audio/stocking.mp3`為使用者已確認兩曲，直接沿用design/music-review-v1程式合成原始MP3。索引metadata/background_music.json；不使用外部歌曲或錄音。正式曲目音量經Web Audio Gain降低，SFX期間短暫壓低BGM。

# v0.15 成就圖集

`ui/achievement_icons.png`：30個原風格像素圖示，5×6格、每格64×64透明；實際只有達成後才在遊戲顯示。鎖定用通用問號。索引與來源見 `metadata/achievement_icons.json`，原始生成及實測切框保存在 `raw/achievements-v015/`；原圖不作等格直接使用。

# 像素素材包 v0.2

已按使用者指示製作店員、三款顧客、店面及介面圖像。原始可見圖像均由 image_gen 生成，經 ImageMagick 確定性切格、對位、最近鄰取樣及組圖集；沒有以程式繪製人物取代生成素材。

## 檔案入口

- `characters/`：14 張角色格表，32×48 px 每格，透明底。
- `environment/`：店面道具、地板／牆面模組及獨立道具。
- `ui/`：16 個介面圖示；圖示尺寸不等於觸控區尺寸。
- `previews/characters_walk.gif`：五組四方向步行總覽。由上至下為店員空手、持貨、年輕顧客、上班族顧客、年長顧客；由左至右為下、左、右、上。
- `previews/customers_carry_walk.gif`：三款顧客持貨離開四方向總覽，列序為年輕／上班族／年長顧客。
- `previews/clerk_work.gif`：取件／放件視覺序列。
- `previews/shop_layout.png`：由獨立素材組合的店面示意，不是遊戲截圖。
- `metadata/asset_manifest.json`：圖集及動畫入口。
- `metadata/qa_report.json`：實際機械檢查結果與限制。
- `metadata/environment_layout.json`：示意擺位與暫定碰撞提案。
- `raw/`、`prompts/`：21 張原始生成圖及完整提示詞；不建議載入遊戲。

## 角色規格

| 圖集 | 格數 | 用途 |
| --- | --- | --- |
| clerk_walk | 32 | 四方向空手步行，每方向 8 格 |
| clerk_carry_walk | 32 | 四方向固定紙箱持貨步行，每方向 8 格 |
| customer_young_walk | 32 | 年輕女顧客，珊瑚紅外套 |
| customer_office_walk | 32 | 男顧客，藍外套、卡其褲 |
| customer_senior_walk | 32 | 年長女顧客，銀髮、紫外套 |
| customer_young_carry_walk | 32 | 年輕女顧客收貨後持貨離開 |
| customer_office_carry_walk | 32 | 上班族顧客收貨後持貨離開 |
| customer_senior_carry_walk | 32 | 年長女顧客收貨後持貨離開 |
| clerk_work | 32 | 四方向各 4 格取件、4 格放件 |
| clerk_idle | 4 | 四方向空手靜止姿勢 |
| clerk_carry_idle | 4 | 四方向持貨靜止姿勢 |
| customer_*_idle | 各 4，共 12 | 三款顧客四方向靜止姿勢 |

合計 308 個角色格，加上道具／地圖／介面各 16 格，共 17 張圖集、356 個格位。

步行表固定 8 欄 × 4 列（256×192 px）。列序為 down、left、right、up，格號由 0 開始，逐列由左向右。錨點為每格 (16,44)，最後一行可見腳底像素為 y=43。靜止表為 4 欄 × 1 列（128×48 px）。

每方向 8 格，建議從 12 fps、循環播放開始；取放動作建議 10 fps、不循環，四格分段。GIF 為相近的 90 ms／格視覺預覽，不與 JSON 的 12 fps 視為完全相同時序。

側身步行已補做窄站距的經過姿勢；左向使用新 4×2 原始序列，右向為其鏡像，因此髮型／制服小配件也會反轉。若未來非對稱裝備有玩法意義，須另製作右向。

動作流暢需在遊戲內同時處理：持續更新角色位置，依移動距離或經過時間推進動畫，停止時切待機，轉向時保留合理步相；不可將移動綁在動畫幀數或螢幕刷新次數。12 fps 動畫不限制遊戲畫面更新率。

## 已做驗證

- 每張圖集尺寸、格數、非空影像及動畫索引範圍。
- 角色透明邊界、二值 alpha、腳底 y=43，以及 32 組四方向步行每組 8 格無完全重複。
- 原圖以完整輪廓分析切取，避免生成圖行距漂移導致切頭／切腳；21 張來源未偵測到輪廓貼外緣。
- 生成 GIF、方向接觸表及店面組合圖；人工檢視代表店員、工作動作與店面比例。

## 保留限制

- 這是可供原型整合的素材 v0.2，尚未在遊戲中驗證走速、轉向、操作、手機縮放、遮擋與效能。
- 8 個不同格位不等於已證明生理正確或最終步態完美。各角色及待機／步行切換仍需實際播放調校。
- 持貨表與工作表的紙箱已畫入角色，屬固定基本紙箱版本；不能直接替換成不同大小包裹。未來要以分層手部／包裹素材支援擴充。
- 工作動作接觸時刻、交付高度及地面／貨架交接須依原型調校，不能只靠動畫更新庫存。
- 貨架前景框是獨立資產，但與主貨架的遮擋對位仍須調整。地圖牆面、門窗為完整模組，不是所有格都可無縫平鋪。
- 自取櫃只有後續使用的視覺模組，未實作或定義第三類玩法。
- 店面圖不是完整遊戲 UI，未做 UI 分數、手機可讀性或留存判定。

## 重建與檢查

在專案根目錄使用 Python（Pillow、NumPy、SciPy）、Node.js 及 ImageMagick 7：

```sh
python3 tools/analyse_asset_sources.py
node tools/build-assets.mjs
node tools/build-asset-previews.mjs
python3 tools/validate-assets.py
python3 tools/package-assets.py
```

輸出重建不會重新呼叫圖片生成；原圖與提示詞均保留。`assets/.packing/` 是可重建的中間檔，下載包不包含它。素材來源及生成提示留在專案內，未聲稱第三方角色或商標授權。

## v0.2 顧客持貨離開

新增三套四方向各八格步行，共 96 格；32×48 px、錨點 (16,44)、建議 12 fps。來源各有一張四方向表及一張側身過渡表，共六張新原圖；右向鏡像左向。原有 11 張角色圖的像素內容已比對一致。

供後續整合的狀態流程為：空手到店 → 排隊／服務 → 成功交貨 → 切換同款顧客持貨表 → 步行離開；超時或未收到貨仍用空手表。離開動畫不是第二次收費或發獎事件。這是整合說明，尚未實作遊戲狀態機。

顧客持貨圖目前為固定基本紙箱，未做持貨待機／接貨過場，也未支援可替換包裹。實際面向切換、交接高度與離開路徑仍需原型驗證。

## v0.3 遊戲整合

使用者已確認 `review-v0.3/map-review.png`。正式遊戲使用獨立地板／牆、貨架、長櫃檯及貨籠，沒有把審核稿或箭頭烘焙為遊戲背景。長櫃檯與開啟的員工閘葉沿用現有 counter 圖像的中段／檯面素材組合。

新增 `characters/courier_walk.png`、`courier_carry_walk.png` 與 `environment/props/outbound_cage.png`。它們是高解像生成來源，必須依 `src/courier-art.js` 及 `metadata/courier_*.json` 的實際來源框處理，不能直接等格切割。遊戲載入時用最近鄰將64格規整到兩張256×192 Canvas圖集，32×48每格、錨點(16,44)，紫色貨籠對齊96×80邏輯畫布；避免逐幀處理高解像圖片。

相應來源及原審核稿保留在 `review-v0.3/`。舊有像素圖像未更改；新版整合狀態以 `PROTOTYPE.md`、`QA_REPORT.md` 及 `CODEX_HANDOFF.md` 為準，上方v0.2素材包的「未整合」描述只屬歷史素材交付狀態。
