(function initDesktopRenderer() {
  const url = new URL(window.location.href)
  const studioBaseUrl = sanitizeBaseUrl(url.searchParams.get('studioBaseUrl') ?? 'http://localhost:3000')

  const frame = document.getElementById('studio')
  if (!(frame instanceof HTMLIFrameElement)) {
    return
  }

  const platformEl = document.getElementById('platform')
  if (window.ghostDesktop?.getPlatform) {
    window.ghostDesktop
      .getPlatform()
      .then(platform => {
        if (platformEl) {
          platformEl.textContent = platform
        }
      })
      .catch(() => {
        if (platformEl) {
          platformEl.textContent = 'desktop'
        }
      })
  }

  const setRoute = route => {
    frame.src = `${studioBaseUrl}${route}`
  }

  document.querySelectorAll('button[data-route]').forEach(button => {
    button.addEventListener('click', () => {
      const route = button.getAttribute('data-route') ?? '/'
      setRoute(route)
    })
  })

  setRoute('/workspace')
})()

function sanitizeBaseUrl(candidate) {
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'http://localhost:3000'
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return 'http://localhost:3000'
  }
}
