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

function baseConfig() {
  return {
    startOnLoad: false,
    securityLevel: 'loose' as const,
    theme: getTheme(),
    fontFamily: 'Inter, -apple-system, sans-serif',
    suppressErrorRendering: true,
    // Use Elk for tightening bounding boxes on flowcharts
    flowchart: { defaultRenderer: 'elk' as const, useMaxWidth: true },
  }
}

export function initMermaid() {
  if (initialized) return
  initialized = true

  mermaid.initialize(baseConfig())

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
  mermaid.initialize(baseConfig())
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

/**
 * Render for image export. Labels are drawn as SVG text instead of HTML
 * (`<foreignObject>`), because a canvas that draws HTML-in-SVG is marked
 * unsafe and refuses to produce an image.
 */
export async function renderMermaidForExport(source: string): Promise<string> {
  if (!initialized) initMermaid()
  const base = baseConfig()
  mermaid.initialize({ ...base, htmlLabels: false, flowchart: { ...base.flowchart, htmlLabels: false, useMaxWidth: false } })
  try {
    const { svg } = await mermaid.render(`mermaid-export-${++renderCounter}`, source)
    return svg
  } finally {
    mermaid.initialize(base)
  }
}

/** Rasterize an SVG string to PNG bytes at `scale`, on a solid background. */
export async function svgToPng(svgText: string, scale: number, background: string): Promise<Uint8Array> {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  const vb = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
  const width = vb && vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute('width') || '800')
  const height = vb && vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute('height') || '600')
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.removeAttribute('style')
  const data = new XMLSerializer().serializeToString(svg)

  const img = new Image()
  img.decoding = 'sync'
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`
  await img.decode()

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not encode the image')
  return new Uint8Array(await blob.arrayBuffer())
}
