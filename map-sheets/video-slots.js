/* Renders <div class="vslot" data-video="key" data-poster="..." data-label="..."> from window.GK_VIDEOS. */
(function () {
  "use strict";
  var V = window.GK_VIDEOS || {}, base = (document.currentScript && document.currentScript.dataset.base) || "";
  var rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function url(p) { return /^(https?:)?\/\//.test(p) || p.charAt(0) === "/" ? p : base + p; }
  function el(t, a) { var e = document.createElement(t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function soon(s, poster, label) {
    s.classList.add("soon");
    var img = el("img", { src: poster, alt: "", loading: "lazy", decoding: "async" }); s.appendChild(img);
    var c = el("p", { class: "vslot-soon" }); c.textContent = "Video coming soon"; s.appendChild(c);
    s.setAttribute("role", "img"); s.setAttribute("aria-label", label + " (video coming soon)");
  }
  function file(s, v, label, spot) {
    var vid = el("video", { preload: "none", playsinline: "", poster: v.poster ? url(v.poster) : s.dataset.poster, "aria-label": v.title || label });
    if (spot) { vid.muted = true; vid.loop = true; vid.setAttribute("muted", ""); if (!rm) vid.autoplay = true; vid.preload = "metadata"; }
    else { vid.controls = true; if (v.loop) vid.loop = true; }
    if (v.webm) vid.appendChild(el("source", { src: url(v.webm), type: "video/webm" }));
    vid.appendChild(el("source", { src: url(v.src), type: "video/mp4" }));
    if (v.captions) vid.appendChild(el("track", { kind: "captions", src: url(v.captions), srclang: v.lang || "en", label: "English", default: "" }));
    s.appendChild(vid);
    if (spot && rm) { vid.controls = true; }
  }
  function yt(s, v, label) {
    var poster = v.poster ? url(v.poster) : s.dataset.poster;
    var b = el("button", { type: "button", class: "vslot-play", "aria-label": "Play video: " + (v.title || label) });
    b.appendChild(el("img", { src: poster, alt: "", loading: "lazy" }));
    var i = el("span", { class: "vslot-icon", "aria-hidden": "true" }); i.textContent = "▶"; b.appendChild(i);
    b.addEventListener("click", function () {
      var f = el("iframe", { src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(v.id) + "?autoplay=1&rel=0&cc_load_policy=1",
        title: v.title || label, allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: "", loading: "lazy",
        referrerpolicy: "strict-origin-when-cross-origin" });
      s.replaceChild(f, b); f.focus();
    });
    s.appendChild(b);
  }
  function render(s) {
    var k = s.dataset.video, v = V[k], label = s.dataset.label || "Video", spot = s.hasAttribute("data-spot");
    if (!v || !(v.src || v.id)) return soon(s, s.dataset.poster, label);
    if (v.type === "youtube" && !spot) return yt(s, v, label);
    if (v.type === "file" || v.src) return file(s, v, label, spot);
    soon(s, s.dataset.poster, label);
  }
  var slots = document.querySelectorAll(".vslot[data-video]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); render(e.target); } }); }, { rootMargin: "300px" });
    slots.forEach(function (s) { io.observe(s); });
  } else slots.forEach(render);
})();
