# v0.19.11 頻寬優化：1、3及音樂
本輪使用者授權圖集預處理、快取及音樂壓縮；不做網頁拆檔或分享圖重新壓縮。保留原畫、玩法、schema11、同網域本機存檔及唯一換日前自存。

## 圖集
兩張送貨員PNG由1448×1086預輸出為256×192、4方向各8格、32×48 cell、(16,44)腳點；寄貨籠預輸出96×80。工具使用現行packRuntimeImage及COURIER_ART同一Canvas轉換，PNG encode/decode後RGBA差異0；正式loader加尺寸guard避免重複裁切，舊原圖路徑fallback仍可處理。原PNG另保留assets/raw/bandwidth-v01911，全部metadata有hash與來源。三張總2,812,544→111,836bytes。沒有用縮圖取代角色動畫。

## 音樂
由原始WAV master重新編碼，營業96kbps／整理64kbps立體聲MP3，44100Hz，不從MP3再壓。原始預覽MP3與作曲render.py不改，master存在deliverables/music-review-v1，缺master時工具可重新合成到獨立輸出。不改音符／BPM／編排／音量控制／音樂loop程式；FFmpeg實際解碼sample frames各與原WAV完全相同，無clipping。合1,887,097→1,436,130bytes（約23.9%）。主觀聽感及實體手機音質未驗。

## 快取範圍
Vercel build輸出static/含內容SHA256前16碼檔名，僅分享PNG及3個主畫面icon。HTML/og/twitter/Apple icon與webmanifest引用hashed URL。/static/(.*)一年public immutable；HTML/version/manifest仍max-age0 must-revalidate。保留root舊PNG/icon路徑與docs/static舊hash供舊分享兼容；來源分享PNG逐byte不變。沒有把首頁長期鎖住，也沒有拆HTML內嵌素材或宣稱重訪整包零下載。Pages能提供相同hashed檔，Vercel快取header只於Vercel生效。
Vercel-only Analytics與實際hostname metadata重寫保留。離線單檔仍自包含圖片音樂，網頁版與離線版僅外部icon/share metadata URL不同。原始製作檔可保留於源碼ZIP但不在部署dist中。

## 證據
132 unit PASS；pack pixel identity3張0差異；FFmpeg解碼frame數／stereo／無clipping PASS；art-smoke3尺寸含舊save/員工/擴架PASS；music-smoke5情境native WebAudio/失敗/延遲/跨日PASS；queue-recovery14鍵盤/觸控情境PASS。bandwidth-smoke核對內容hash／cache作用域／HTML更新／metadata／未變分享PNG PASS。完整browser-smoke五組桌面／純觸控情境包含courier收卸貨／空手離場／跨日／不限時上架PASS；最後發布另見release-report。
原生WebAudio切曲會120ms crossfade，原music測試早讀到2sources，已隔離重現20ms有1fading、250ms回1；只修測試等待business:2穩態，runtime music.js不改。
