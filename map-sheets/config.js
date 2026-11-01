// Sheet service settings for the live demo. Change API_BASE when the service is hosted publicly,
// and add the same origin to img-src and connect-src in this page's Content-Security-Policy.
window.GK_SHEETS = {
  API_BASE: "http://127.0.0.1:8095",
  POLL_MS: 3000,
  HEALTH_TIMEOUT_MS: 3000
};
