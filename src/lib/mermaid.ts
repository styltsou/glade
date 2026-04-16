import mermaid from 'mermaid'

// SVG cache keyed by source string
const svgCache = new Map<string, string>()

let initialized = false

function getTheme(): 'dark' | 'default' {
  // Check the data-mode attribute used by the app's theme system
  const mode = document.documentElement.getAttribute('data-mode')
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'default'
  // Fallback to system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
}

export function initMermaid() {
  if (initialized) return
  initialized = true

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: getTheme(),
    fontFamily: 'Inter, -apple-system, sans-serif',
    suppressErrorRendering: true,
    // Use Elk for tightening bounding boxes on flowcharts
    flowchart: { defaultRenderer: 'elk', useMaxWidth: true }
  })

  // Re-initialize when system theme changes
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  mql.addEventListener('change', () => {
    reinitMermaid()
  })

  // Watch for data-mode attribute changes on <html>
  const observer = new MutationObserver(() => {
    reinitMermaid()
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-mode'],
  })
}

function reinitMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: getTheme(),
    fontFamily: 'Inter, -apple-system, sans-serif',
    suppressErrorRendering: true,
    flowchart: { defaultRenderer: 'elk', useMaxWidth: true }
  })
  // Clear cache since theme changed
  svgCache.clear()
  // Notify listeners
  themeChangeListeners.forEach(fn => fn())
}

// Theme change event system
type ThemeChangeListener = () => void
const themeChangeListeners = new Set<ThemeChangeListener>()

export function onMermaidThemeChange(fn: ThemeChangeListener): () => void {
  themeChangeListeners.add(fn)
  return () => { themeChangeListeners.delete(fn) }
}

// Unique ID counter for mermaid render calls
let renderCounter = 0

export async function renderMermaid(source: string): Promise<{ svg: string }> {
  if (!source.trim()) {
    throw new Error('Empty diagram source')
  }

  // Check cache
  const cached = svgCache.get(source)
  if (cached) {
    return { svg: cached }
  }

  // Ensure initialized
  if (!initialized) {
    initMermaid()
  }

  const id = `mermaid-render-${++renderCounter}`
  const { svg } = await mermaid.render(id, source)

  // Cache the result
  svgCache.set(source, svg)

  return { svg }
}
