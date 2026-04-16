import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MermaidBlockView } from './MermaidBlockView'

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-source') || '',
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.source) return {}
          return { 'data-source': attributes.source }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'mermaid-block', ...HTMLAttributes }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView)
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write('```mermaid\n')
          state.text(node.attrs.source || '', false)
          state.ensureNewLine()
          state.write('```')
          state.closeBlock(node)
        },
        parse: {
          setup(markdownit: any) {
            // Save original fence renderer
            const defaultFence = markdownit.renderer.rules.fence ||
              function (tokens: any, idx: any, options: any, _env: any, slf: any) {
                return slf.renderToken(tokens, idx, options)
              }

            // Override fence renderer to intercept mermaid blocks
            markdownit.renderer.rules.fence = function (
              tokens: any,
              idx: any,
              options: any,
              env: any,
              slf: any,
            ) {
              const token = tokens[idx]
              const info = token.info?.trim()

              if (info === 'mermaid') {
                const source = token.content.trim()
                // Encode source as data attribute for parseHTML to pick up
                const escapedSource = source
                  .replace(/&/g, '&amp;')
                  .replace(/"/g, '&quot;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                return `<div data-type="mermaid-block" data-source="${escapedSource}"></div>`
              }

              return defaultFence(tokens, idx, options, env, slf)
            }
          },
          updateDOM(element: HTMLElement) {
            // Convert data-source attributes into proper node attributes
            element.querySelectorAll('div[data-type="mermaid-block"]').forEach((el) => {
              const source = el.getAttribute('data-source')
              if (source) {
                // Decode the escaped source
                const decoded = source
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                el.setAttribute('data-source', decoded)
              }
            })
          },
        },
      },
    }
  },
})
