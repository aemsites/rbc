let config;

export default function getPublicConfig() {
  config = config || fetch('/config.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => j.public || {})
    .catch(() => ({}));
  return config;
}
