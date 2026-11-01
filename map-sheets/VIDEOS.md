# Adding videos to the map-sheets pages

All video placements are set in `map-sheets/videos.js`. Until an entry is set, its slot shows a poster
still with "Video coming soon".

| Key | Where |
|---|---|
| `spotlight` | Homepage Featured card (local file only; muted loop, no autoplay with reduced motion) |
| `hero` | Landing page hero |
| `watch1`–`watch3` | Landing page "Watch how it works" |
| `step1`–`step5` | Small clips beside the five how-it-works steps |

**Local file** (put files in `map-sheets/video/`; keep clips short, H.264 MP4, ideally under 5 MB, plus an optional WebM):

```js
hero: { type: "file", src: "video/hero.mp4", webm: "video/hero.webm", poster: "video/hero.jpg",
        captions: "video/hero.en.vtt", title: "Building a sheet for Idaho Springs, CO" },
```

**YouTube** (embedded from youtube-nocookie.com only after the visitor clicks play):

```js
watch1: { type: "youtube", id: "VIDEO_ID", title: "Pick a point on the map", poster: "img/idaho-springs-detail.webp" },
```

Captions: add a WebVTT file (`captions:`) for local videos; for YouTube, upload captions on YouTube
(they're shown by default). Give every video a `title`.

Bump `?v=` on the `videos.js` script tag after editing so browsers fetch the new config. The landing page's
Content-Security-Policy already allows `https://www.youtube-nocookie.com` frames; the homepage allows local files only.
