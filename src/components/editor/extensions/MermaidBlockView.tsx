import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewWrapper } from '@tiptap/react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import {
  Edit,
  Code,
  Eye,
  Copy,
  Check,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  ChevronFirst,
  ChevronLast
} from 'lucide-react'
import { useStore } from '@/store'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { renderMermaid, onMermaidThemeChange } from '@/lib/mermaid'

interface MermaidBlockViewProps {
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
  deleteNode: () => void
  selected: boolean
  editor: any
}

export function MermaidBlockView({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: MermaidBlockViewProps) {
  const source: string = node.attrs.source || ''

  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')
  const setMermaidFullscreenOpen = useStore((state) => state.setMermaidFullscreenOpen)
  const [isFullViewOpen, setIsFullViewOpen] = useState(false)
  const [showCodePane, setShowCodePane] = useState(true)
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
    setPortalTarget(document.getElementById('note-overlay-portal'))
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

  // Debounced render on draft change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doRender(draft)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [draft, doRender])

  // Initial render for committed source
  useEffect(() => {
    if (source) {
      doRender(source)
    }
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

  const handleExportPng = useCallback(async () => {
    if (!previewSvg) return
    try {
      const dest = await save({
        defaultPath: 'diagram.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      })
      if (!dest) return

      const svgElement = document.createElement('div')
      svgElement.innerHTML = previewSvg
      const svg = svgElement.querySelector('svg')
      if (!svg) return
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const svgData = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = document.createElement('img')
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      img.onload = async () => {
        canvas.width = img.width * 2
        canvas.height = img.height * 2
        if (ctx) {
          ctx.scale(2, 2)
          ctx.fillStyle = 'transparent'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          const dataUrl = canvas.toDataURL('image/png')
          const base64Data = dataUrl.split(',')[1]
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          await invoke('write_file', { path: dest, contents: Array.from(bytes) })
        }
        URL.revokeObjectURL(url)
      }
      img.src = url
    } catch (e) {
      console.error('Export error:', e)
    }
  }, [previewSvg])

  // Theme detection for CodeMirror
  const cmTheme = useMemo(() => {
    const isDark = document.documentElement.getAttribute('data-mode') === 'dark'
    return isDark ? oneDark : 'light'
  }, [])

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

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  setIsFullViewOpen(true)
                  setMermaidFullscreenOpen(true)
                  setDraft(source)
                  setShowCodePane(true)
                }}
              >
                <Edit className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Edit Full Screen</p>
            </TooltipContent>
          </Tooltip>

          {editor?.isEditable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => deleteNode()}
                  className="hover:!text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Delete Diagram</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Inline Content */}
        {viewMode === 'preview' ? (
          <div className="mermaid-block-rendered outline-none" tabIndex={-1}>
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

      {/* ─── Full Editor Overlay ─── */}
      {isFullViewOpen && portalTarget && createPortal(
        <div className="mermaid-full-overlay">
          {/* Minimal Header */}
<div className="mermaid-full-header">
            <button
              type="button"
              className="mermaid-full-close"
              onClick={() => {
                updateAttributes({ source: draft })
                setIsFullViewOpen(false)
                setMermaidFullscreenOpen(false)
              }}
            >
              <X className="size-4" />
            </button>

            <button
              type="button"
              className="mermaid-full-toggle-btn"
              onClick={() => setShowCodePane(!showCodePane)}
            >
              {showCodePane ? <ChevronFirst className="size-4" /> : <ChevronLast className="size-4" />}
              <span className="text-sm">{showCodePane ? 'Hide code' : 'Show code'}</span>
            </button>

            <div className="flex items-center ml-auto">
              <button
                type="button"
                className="mermaid-full-action-btn"
                onClick={() => handleCopySource(draft)}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>

              <button
                type="button"
                className="mermaid-full-action-btn"
                onClick={handleExportPng}
              >
                <Download className="size-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className={`mermaid-full-body ${showCodePane ? '' : 'mermaid-full-body-expanded'}`}>
            {/* Source Pane */}
            <div className={`mermaid-full-pane-source ${showCodePane ? '' : 'hidden'}`}>
              <div className="mermaid-full-cm-wrapper">
                <CodeMirror
                  value={draft}
                  height="100%"
                  theme={cmTheme}
                  extensions={[markdown()]}
                  onChange={(value) => setDraft(value)}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                  }}
                  autoFocus
                />
              </div>
              {error && (
                <div className="mermaid-full-error">
                  <strong>Render Error:</strong> {error}
                </div>
              )}
            </div>

            {/* Canvas Pane */}
            <div className="mermaid-full-pane-canvas">
              <TransformWrapper
                initialScale={1}
                minScale={0.1}
                maxScale={10}
                centerOnInit={true}
                doubleClick={{ disabled: false, mode: 'reset' }}
              >
                {({ zoomIn, zoomOut, resetTransform, centerView }) => (
                  <div className="mermaid-full-preview">
                    <TransformComponent
                      wrapperStyle={{ width: '100%', height: '100%' }}
                      contentStyle={{ 
                        width: '100%', 
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div className="mermaid-canvas-container">
                        {previewSvg ? (
                          <div 
                            className="mermaid-svg-container-canvas" 
                            dangerouslySetInnerHTML={{ __html: previewSvg }} 
                          />
                        ) : (
                          <div className="mermaid-block-empty">
                            {draft.trim() ? 'Rendering...' : 'Empty Diagram'}
                          </div>
                        )}
                      </div>
                    </TransformComponent>
                    
                    {/* Floating Zoom Controls */}
                    <div className="mermaid-full-zoom-controls">
                      <button type="button" onClick={() => zoomIn()} title="Zoom In">
                        <ZoomIn className="size-4" />
                      </button>
                      <button type="button" onClick={() => zoomOut()} title="Zoom Out">
                        <ZoomOut className="size-4" />
                      </button>
                      <button type="button" onClick={() => { centerView(); resetTransform(); }} title="Reset">
                        <Maximize className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </TransformWrapper>
            </div>
          </div>
        </div>,
        portalTarget
      )}
    </NodeViewWrapper>
  )
}
