import { useState } from 'react'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      const [copied, setCopied] = useState(false)
      const language = node.attrs.language || 'text'

      const copyToClipboard = () => {
        navigator.clipboard.writeText(node.textContent)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }

      return (
        <NodeViewWrapper className="code-block relative group">
          <div className="absolute right-2 top-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <span className="text-[10px] uppercase font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              {language}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-muted/50 hover:bg-muted"
              onClick={copyToClipboard}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <pre>
            <NodeViewContent as="div" className="inline" />
          </pre>
        </NodeViewWrapper>
      )
    })
  },
})
