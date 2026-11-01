// Sheet service settings for the live demo (public service behind a Cloudflare Tunnel).
// If API_BASE changes, update img-src and connect-src in this page's Content-Security-Policy.
window.GK_SHEETS = {
  API_BASE: "https://sheets.geoknightgis.com",
  POLL_MS: 3000,
  HEALTH_TIMEOUT_MS: 6000
};
