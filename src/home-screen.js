// Platform hints only; no gameplay state or persistence.
export function homeScreenPlatform({userAgent='',platform='',maxTouchPoints=0,standalone=false}={}) {
 if(standalone)return null;
 const ios=/iPhone|iPad|iPod/i.test(userAgent)||(platform==='MacIntel'&&maxTouchPoints>1);
 if(ios)return /CriOS/i.test(userAgent)?'chrome-ios':'safari';
 if(/Android/i.test(userAgent))return /Chrome/i.test(userAgent)&&!/EdgA|OPR|SamsungBrowser/i.test(userAgent)?'chrome-android':'android-other';
 return null;
}
