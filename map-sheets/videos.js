// Video slots for the map-sheets pages. Leave an entry null to show its poster and "Video coming soon".
// Local file:  { type: "file", src: "video/clip.mp4", webm: "video/clip.webm", poster: "video/clip.jpg",
//                captions: "video/clip.en.vtt", title: "...", loop: false }
// YouTube:     { type: "youtube", id: "VIDEO_ID", title: "...", poster: "img/..." }  (loads youtube-nocookie.com on click)
// Paths are relative to the map-sheets/ folder. See VIDEOS.md.
window.GK_VIDEOS = {
  spotlight: null,      // homepage Featured card (local file only; plays muted on loop)
  hero: null,           // landing page hero
  watch1: null,         // "Watch how it works" 1: pick a point
  watch2: null,         // 2: the sheet builds
  watch3: null,         // 3: zooming into the finished PDF
  step1: null, step2: null, step3: null, step4: null, step5: null   // small clips beside the steps
};
