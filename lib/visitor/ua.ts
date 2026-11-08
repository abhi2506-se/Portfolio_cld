export interface UaInfo { deviceCategory: 'mobile' | 'tablet' | 'desktop'; browser: string; os: string }

export function parseUserAgent(ua: string | null | undefined): UaInfo {
  const s = (ua || '').slice(0, 400)
  const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s)
  const isMobile = !isTablet && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(s)
  const deviceCategory = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  let browser = 'Unknown'
  if (/Edg(e|A|iOS)?\//.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera'
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung Internet'
  else if (/Firefox\/|FxiOS/.test(s)) browser = 'Firefox'
  else if (/Chrome\/|CriOS/.test(s)) browser = 'Chrome'
  else if (/Safari\//.test(s)) browser = 'Safari'

  let os = 'Unknown'
  if (/Windows NT/.test(s)) os = 'Windows'
  else if (/Android/.test(s)) os = 'Android'
  else if (/iPhone|iPad|iPod/.test(s)) os = 'iOS'
  else if (/Mac OS X|Macintosh/.test(s)) os = 'macOS'
  else if (/CrOS/.test(s)) os = 'ChromeOS'
  else if (/Linux/.test(s)) os = 'Linux'
  return { deviceCategory, browser, os }
}
