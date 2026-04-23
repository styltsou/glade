import {
  CircleCheck as CheckCircledIcon,
  Info as InfoCircledIcon,
  Loader2 as UpdateIcon,
  CircleX as CrossCircledIcon,
  TriangleAlert as ExclamationTriangleIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton
      icons={{
        success: <CheckCircledIcon className="size-4" />,
        info: <InfoCircledIcon className="size-4" />,
        warning: <ExclamationTriangleIcon className="size-4" />,
        error: <CrossCircledIcon className="size-4" />,
        loading: <UpdateIcon className="size-4 animate-spin" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
