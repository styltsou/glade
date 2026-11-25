import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewWrapper } from '@tiptap/react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import {
  Code,
  Eye,
  Copy,
  Check,
  Download,
} from 'lucide-react'
import { useStore } from '@/store'
import { AnimatePresence } from 'motion/react'
import { MermaidFullView } from './MermaidFullView'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
  const setMermaidFullscreenOpen = useStore((state) => state.setMermaidFullscreenOpen)
  const [isFullViewOpen, setIsFullViewOpen] = useState(false)
  const [draft, setDraft] = useState(source)
  const [svg, setSvg] = useState<string | null>(null)
  const [lastValidSvg, setLastValidSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [copied, setCopied] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Instant render when in code view (typing), deferred for initial/preview
  useEffect(() => {
    if ((viewMode === 'code' || isFullViewOpen) && draft !== source) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        doRender(draft)
      }, 150)
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
      }
    }
  }, [draft, viewMode, isFullViewOpen, source, doRender])

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
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
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

  // Auto-resize textarea height
  useLayoutEffect(() => {
    if (viewMode === 'code' && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [draft, viewMode])

  // Position cursor at end when switching to code mode
  useEffect(() => {
    if (viewMode === 'code' && textareaRef.current) {
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
      textareaRef.current.focus()
    }
  }, [viewMode])

  // ─── Inline View ───
  return (
    <NodeViewWrapper data-type="mermaid-block">
      <div className="mermaid-block group/mermaid">
        {/* Inline Toolbar */}
        <div className="mermaid-block-toolbar">
          {viewMode === 'preview' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={handleExportPng}>
                  <Download className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Export as PNG</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => handleCopySource(source)}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Copy Source</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => setViewMode(viewMode === 'preview' ? 'code' : 'preview')}>
                {viewMode === 'preview' ? <Code className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{viewMode === 'preview' ? 'Show Code' : 'Show Preview'}</p>
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
          <div className="mermaid-block-source">
            <textarea
              ref={textareaRef}
              className="mermaid-block-textarea"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                updateAttributes({ source: e.target.value })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setViewMode('preview')
                }
                e.stopPropagation()
              }}
              placeholder="Type mermaid diagram syntax..."
              spellCheck={false}
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
