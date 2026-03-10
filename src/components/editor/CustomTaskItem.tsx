import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import TaskItem from '@tiptap/extension-task-item'
import { Checkbox } from '@/components/ui/checkbox'

export const CustomTaskItem = TaskItem.extend({
  addNodeView() {
    return ReactNodeViewRenderer((props) => {
      const { node, updateAttributes, editor } = props;
      const checked: boolean = node.attrs.checked;
      
      return (
        <NodeViewWrapper
          as="li"
          data-type="taskItem"
          data-checked={checked ? "true" : "false"}
        >
          <label contentEditable={false} className="cursor-pointer mt-[0.15em] flex items-center justify-center">
            <Checkbox
              className="cursor-pointer"
              checked={checked}
              onCheckedChange={(newChecked) => {
                if (!editor.isEditable) return;
                updateAttributes({ checked: !!newChecked });
              }}
            />
          </label>
          <NodeViewContent className="flex-1 min-w-0" as="div" />
        </NodeViewWrapper>
      )
    })
  }
})
