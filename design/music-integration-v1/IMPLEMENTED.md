# v0.16 背景音樂實裝

2026-10-26（香港）。使用者已明確確認「將兩首音樂實裝」，解除試聽限制。設定功能仍只提供選項提案，不加入設定介面。

## 已採用曲目

assets/audio/business.mp3〈街坊開檔〉及stocking.mp3〈收工慢慢執〉與已確認試聽MP3逐byte相同；音符、音色及速度不改。營業104 BPM／73.846秒，整理84 BPM／68.571秒。來源metadata/background_music.json及design/music-review-v1/render.py。

- 首頁不播放；主動點擊或鍵盤操作解鎖Web Audio後，正式開店／繼續營業才播放營業曲。選貨及工作詳情仍屬營業，音樂連續。
- 關店摘要、升級詢問／商店、不限時上架共用同日整理曲，面板切換不重播開頭。
- 暫停、主選單、背景／離焦、失去分頁擁有權及換日保存停播。暫停續玩保留同曲播放位置；換日營業曲重新開始。音樂位置不存進店舖進度。
- 短場景轉換最多0.12秒淡出舊曲，新曲0.25秒淡入；明確暫停／背景立即停止，包括尚在淡出的曲目。正常只一個主音源，過渡後不重複疊加。

## 技術及既有契約

src/music.js只掌管表現層，一個共用AudioContext提供BGM及原有提示音。BGM透過Gain設為原音量25%，提示音期間短暫降至其30%，0.25秒回復，以保留交貨／錯件辨識。不是新增可調設定。

只在需要時解碼，各曲快取一次。重複按鍵／開關面板不開新Context；暫停／切日後即使舊解碼稍後完成，也不能重啟錯誤曲目。AudioContext、載入或解碼失敗時略過音樂，遊戲仍可正常計時、工作、日結及保存。

舊正式存檔sound:false同時保持音樂及音效靜音，不偷偷取消玩家原有靜音偏好。src/save.js僅更新appVersion0.16.0；schema9／settings.sound布林及所有遊戲狀態契約不變，沒有新自動保存。音樂不消耗遊戲RNG，不加錢、不改客流、耐性、營業120秒或升級。

正式單檔以audio/mpeg data URL內嵌原MP3，無外部音樂服務；ZIP同時包含音檔與音樂模組。開發server允許assets/audio及MP3 MIME。使用Web Audio Gain，避免依賴iOS可能忽略的HTMLMediaElement.volume。

## 驗證

tests/music-smoke.mjs：實際解碼／AudioContext，首頁不自播、桌面及觸控解鎖、營業／整理／換日、原SFX共用Context、暫停及成就往返、主選單／繼續、失焦停止、延遲解碼不能在暫停後復活、舊靜音檔、音訊API失敗不阻擋營業，五組情境PASS；離線無外部請求。詳deliverables/music-integration-report.json。

111規則為原有狀態／金錢／存檔回歸；完整鍵盤／純觸控、五尺寸離線及原生存檔smoke另核對。所有實際結果以對應報告為準。主音樂循環使用原生Web Audio loop；原MP3跨尾端循環已在獨立試聽驗證，不宣稱本輪已等候每首實時播放一整圈。

手機畫面、字級及控制位置不改，不新增HUD或音樂視窗。Android／iPhone／Safari真機、OS實際中斷、裝置音量／喇叭聽感及長時間記憶體／效能仍UNVERIFIED。
