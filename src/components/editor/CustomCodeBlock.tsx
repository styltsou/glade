import { useState, useEffect } from 'react'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CodeBlockView = ({ node }: any) => {
  const [copied, setCopied] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const language = node.attrs.language;

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
    <NodeViewWrapper className={cn("code-block relative group", language && "!pt-10")}>
      {language && (
        <div className="absolute top-0 left-0 h-8 px-3 flex items-center justify-center bg-background border-r border-b border-border text-[10px] font-mono font-medium text-muted-foreground/85 uppercase tracking-widest select-none rounded-br-sm z-20">
          <span className="translate-y-[1px]">{language}</span>
        </div>
      )}
      <div className={cn(
        "absolute top-0 right-0 h-8 w-10 flex items-center justify-center bg-background border-l border-b border-border rounded-bl-sm z-20",
        showButton ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      )}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-full w-full rounded-none rounded-bl-sm !transition-none",
            copied ? "text-foreground" : "text-muted-foreground/85 hover:text-foreground hover:bg-muted/50 hover:!transition-[background-color] hover:!duration-100"
          )}
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