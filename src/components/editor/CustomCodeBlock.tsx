import { useState, useEffect } from 'react'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { CodeLanguagePicker } from './CodeLanguagePicker'
import type { Attributes } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Check, Copy } from 'lucide-react'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const CodeBlockView = ({ node, editor, updateAttributes }: NodeViewProps) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let iconTimer: ReturnType<typeof setTimeout>
    if (copied) {
      iconTimer = setTimeout(() => {
        setCopied(false)
      }, 1700)
      
      return () => {
        if (iconTimer) clearTimeout(iconTimer)
      }
    }
  }, [copied])

  const copyToClipboard = async () => {
    try {
      // The webview's clipboard API is not reliably allowed; the rest of the app copies this way too.
      await writeText(node.textContent)
      setCopied(true)
    } catch {
      toast.error("Couldn't copy the code")
    }
  }

  return (
    <NodeViewWrapper className="code-block">
      <div className="code-block-header" contentEditable={false}>
        <CodeLanguagePicker
          language={node.attrs.language}
          onChange={(language) => updateAttributes({ language })}
          onClose={() => editor.view.focus()}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="code-block-btn"
              aria-label={copied ? "Copied" : "Copy code"}
              onClick={copyToClipboard}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{copied ? "Copied" : "Copy code"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="code-block-content">
        <pre>
          <NodeViewContent as="div" className="inline" />
        </pre>
      </div>
    </NodeViewWrapper>
  )
}

export const CustomCodeBlock = CodeBlockLowlight.extend({
  // `defaultLanguage` only picks the grammar for a block without one; the
  // block itself keeps no language, so its fence stays bare in the file.
  addAttributes() {
    const attributes: Attributes = this.parent?.() ?? {}
    return { ...attributes, language: { ...attributes.language, default: null } }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})