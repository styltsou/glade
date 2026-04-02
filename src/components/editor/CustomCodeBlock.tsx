import { useState, useEffect } from 'react'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CodeBlockView = ({ node }: any) => {
  const [copied, setCopied] = useState(false)
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    let iconTimer: ReturnType<typeof setTimeout>
    if (copied) {
      const fadeTimer = setTimeout(() => {
        setShowButton(false)
        iconTimer = setTimeout(() => {
          setCopied(false)
        }, 200)
      }, 1500)
      
      return () => {
        clearTimeout(fadeTimer)
        if (iconTimer) clearTimeout(iconTimer)
      }
    }
  }, [copied])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(node.textContent)
    setCopied(true)
    setShowButton(true)
  }

  return (
    <NodeViewWrapper className="code-block relative group">
      <div className={`absolute right-2 top-2 z-10 transition-opacity duration-300 ${showButton ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 bg-muted/50 hover:bg-muted"
          onClick={copyToClipboard}
        >
          {copied ? <Check key="check" className="h-3.5 w-3.5" /> : <Copy key="copy" className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre>
        <NodeViewContent as="div" className="inline" />
      </pre>
    </NodeViewWrapper>
  )
}

export const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})