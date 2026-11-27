import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { CopyIcon, IconSwap } from '@/components/ui/icon-swap'
import { createPortal } from 'react-dom'
import { NodeViewWrapper } from '@tiptap/react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import {
  Code,
  Eye,
  Download,
} from 'lucide-react'
import { useStore } from '@/store'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { MermaidFullView } from './MermaidFullView'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import CodeMirror from '@uiw/react-codemirror'
import { mermaidInlineExtensions } from '@/lib/mermaidCodemirror'

import { renderMermaid, renderMermaidForExport, svgToPng, onMermaidThemeChange } from '@/lib/mermaid'

interface MermaidBlockViewProps {
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
}

export function MermaidBlockView({
  node,
  updateAttributes,
}: MermaidBlockViewProps) {
  const source: string = node.attrs.source || ''

  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')
  const reduceMotion = useReducedMotion()
  const blockRef = useRef<HTMLDivElement>(null)
  /** The block's height as the view switched, to grow or shrink from. */
  const switchedFrom = useRef<number | null>(null)
  const heightAnimation = useRef<Animation | null>(null)

  // Flipping between diagram and code changes the block's height a lot. Read
  // it now (mid-animation, where it is), and the view change below animates
  // from there. Not from the keyboard (Esc): a key press gets its result at once.
  const switchView = (next: 'preview' | 'code', { animate = true } = {}) => {
    if (next === viewMode) return
    switchedFrom.current = animate ? blockRef.current?.offsetHeight ?? null : null
    heightAnimation.current?.cancel()
    setViewMode(next)
  }

  // Grow or shrink to the new view's height, pushing the note below along with
  // it, while the new view fades in through a slight blur: quick, and only
  // when the view switches (typing in the code view resizes it at once).
  useLayoutEffect(() => {
    const block = blockRef.current
    const from = switchedFrom.current
    switchedFrom.current = null
    if (!block || from === null || reduceMotion) return
    const motion = { duration: 110, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
    block.lastElementChild?.animate(
      [{ opacity: 0, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0)' }],
      motion,
    )
    // Hold the old height until the new view has laid out (the code editor
    // mounts in an effect), then measure and animate.
    block.style.height = `${from}px`
    const frame = requestAnimationFrame(() => {
      block.style.height = ''
      const to = block.offsetHeight
      if (Math.abs(to - from) < 1) return
      heightAnimation.current = block.animate([{ height: `${from}px` }, { height: `${to}px` }], motion)
    })
    return () => {
      cancelAnimationFrame(frame)
      block.style.height = ''
    }
  }, [viewMode, reduceMotion])
  const setMermaidFullscreenOpen = useStore((state) => state.setMermaidFullscreenOpen)
  const [isFullViewOpen, setIsFullViewOpen] = useState(false)
  const [draft, setDraft] = useState(source)
  const [svg, setSvg] = useState<string | null>(null)
  const [lastValidSvg, setLastValidSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [copied, setCopied] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  
  /** The source last sent to Mermaid, so the same text isn't drawn twice. */
  const renderedRef = useRef<string | null>(null)

  // Find portal target on mount
  useEffect(() => {
    setPortalTarget(document.getElementById('note-fullview-portal'))
  }, [])

  // Sync draft when source changes externally (if not in full editor)
  useEffect(() => {
    if (!isFullViewOpen) {
      setDraft(source)
    }
  }, [source, isFullViewOpen])

  // Render diagram (debounced)
  const doRender = useCallback(async (src: string) => {
    renderedRef.current = src
    if (!src.trim()) {
      setSvg(null)
      setError(null)
      return
    }
    setIsRendering(true)
    try {
      const result = await renderMermaid(src)
      setSvg(result.svg)
      setLastValidSvg(result.svg)
      setError(null)
    } catch (e: any) {
      const msg = e?.message || 'Parse error'
      setError(msg.replace(/^Error: /, '').slice(0, 200))
    } finally {
      setIsRendering(false)
    }
  }, [])

  // Redraw shortly after the text changes: typing in either code view, or the
  // note changing underneath. (The inline view saves every keystroke, so the
  // text never differs from the saved source; compare with what was drawn.)
  useEffect(() => {
    if (draft === renderedRef.current) return
    const timer = setTimeout(() => {
      if (draft !== renderedRef.current) doRender(draft)
    }, 150)
    return () => clearTimeout(timer)
  }, [draft, doRender])

  // Deferred initial render - let editor paint first
  useEffect(() => {
    if (!source) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        doRender(source)
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render on theme change
  useEffect(() => {
    return onMermaidThemeChange(() => {
      const currentSource = isFullViewOpen ? draft : source
      if (currentSource) {
        doRender(currentSource)
      }
    })
  }, [isFullViewOpen, draft, source, doRender])

  // Copy helpers
  const handleCopySource = useCallback(async (text: string) => {
    try {
      // The webview's clipboard API is not reliably allowed; the rest of the app copies this way too.
      await writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy the code")
    }
  }, [])

  const previewSvg = error ? lastValidSvg : (svg || lastValidSvg)

  const openFullView = useCallback(() => {
    setDraft(source)
    setIsFullViewOpen(true)
    setMermaidFullscreenOpen(true)
  }, [source, setMermaidFullscreenOpen])

  const closeFullView = useCallback(() => {
    updateAttributes({ source: draft })
    setIsFullViewOpen(false)
    setMermaidFullscreenOpen(false)
  }, [draft, updateAttributes, setMermaidFullscreenOpen])

  const handleExportPng = useCallback(async () => {
    const src = draft.trim() ? draft : source
    if (!src.trim()) return
    try {
      const dest = await save({
        defaultPath: 'diagram.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      })
      if (!dest) return
      const svgText = await renderMermaidForExport(src)
      // The page background is transparent (rounded window), so read the theme's.
      const probe = document.createElement('div')
      probe.className = 'bg-background'
      document.body.appendChild(probe)
      const background = getComputedStyle(probe).backgroundColor || '#ffffff'
      probe.remove()
      const bytes = await svgToPng(svgText, 3, background)
      await invoke('write_file', { path: dest, contents: Array.from(bytes) })
      toast.success('Diagram exported')
    } catch (e) {
      console.error('Export error:', e)
      toast.error(`Could not export the diagram: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [draft, source])

  // ─── Inline View ───
  return (
    <NodeViewWrapper data-type="mermaid-block">
      <div ref={blockRef} className="mermaid-block group/mermaid">
        {/* Inline Toolbar */}
        {/* The same buttons in both views, so none moves when the view flips. */}
        <div className="mermaid-block-toolbar">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={copied ? 'Copied' : 'Copy code'} onClick={() => handleCopySource(source)}>
                <CopyIcon copied={copied} className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{copied ? 'Copied' : 'Copy code'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Export as PNG" onClick={handleExportPng}>
                <Download className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Export as PNG</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={viewMode === 'preview' ? 'Show code' : 'Show diagram'}
                onClick={() => switchView(viewMode === 'preview' ? 'code' : 'preview')}
              >
                <IconSwap show={viewMode} icons={{ preview: <Code className="size-3.5" />, code: <Eye className="size-3.5" /> }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{viewMode === 'preview' ? 'Show code' : 'Show diagram'}</p>
            </TooltipContent>
          </Tooltip>

        </div>

        {/* Inline Content */}
        {viewMode === 'preview' ? (
          <div
            className="mermaid-block-rendered cursor-zoom-in outline-none"
            tabIndex={0}
            role="button"
            aria-label="Open diagram in full view"
            onClick={openFullView}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openFullView()
              }
            }}
          >
            {previewSvg ? (
              <div className="mermaid-svg-container" dangerouslySetInnerHTML={{ __html: previewSvg }} />
            ) : (
              <div className="mermaid-block-empty">
                {isRendering ? 'Rendering...' : 'Empty Diagram'}
              </div>
            )}
          </div>
        ) : (
          <div
            className="mermaid-block-source"
            onKeyDown={(e) => {
              // Esc goes back to the diagram; keys typed here stay out of the app's shortcuts.
              if (e.key === 'Escape') switchView('preview', { animate: false })
              e.stopPropagation()
            }}
          >
            <CodeMirror
              value={draft}
              theme="none"
              extensions={mermaidInlineExtensions}
              onChange={(value) => {
                setDraft(value)
                updateAttributes({ source: value })
              }}
              placeholder="Type Mermaid syntax"
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                highlightSelectionMatches: true,
                bracketMatching: true,
                autocompletion: false,
                searchKeymap: false,
              }}
              // Opens with the caret at the end of the source.
              onCreateEditor={(view) => {
                view.dispatch({ selection: { anchor: view.state.doc.length } })
                view.focus()
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Full View ─── */}
      {portalTarget && createPortal(
        <AnimatePresence>
          {isFullViewOpen && (
            <MermaidFullView
              draft={draft}
              onDraftChange={setDraft}
              svg={previewSvg}
              error={error}
              copied={copied}
              onCopy={() => handleCopySource(draft)}
              onExport={handleExportPng}
              onClose={closeFullView}
            />
          )}
        </AnimatePresence>,
        portalTarget
      )}
    </NodeViewWrapper>
  )
}
