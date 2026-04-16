import { useState, useEffect } from 'react'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

const CodeBlockView = ({ node }: any) => {
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(node.textContent)
    setCopied(true)
  }

  const language = node.attrs.language;

  return (
    <NodeViewWrapper className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang-label">{language || 'code'}</span>
        <button 
          type="button" 
          className={cn("code-block-btn", copied && "visible")} 
          onClick={copyToClipboard}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
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
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})