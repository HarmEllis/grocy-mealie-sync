"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonVariantProps } from "./button-styles"

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & ButtonVariantProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
