import React from 'react';
import clsx from 'clsx';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  /** When true, the modal is open. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

// Root — manages open state via `open` / `onOpenChange`.
const Modal = DialogPrimitive.Root;

// Trigger — must be rendered as a child of <Modal>.
export interface ModalTriggerProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger> {
  asChild?: boolean;
}

const ModalTrigger = React.forwardRef<HTMLButtonElement, ModalTriggerProps>(
  ({ children, asChild = false, ...props }, ref) => (
    <DialogPrimitive.Trigger ref={ref} asChild={asChild} {...props}>
      {children}
    </DialogPrimitive.Trigger>
  )
);
ModalTrigger.displayName = 'ModalTrigger';

// Overlay
const ModalOverlay = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      className={clsx(
        'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        className
      )}
      {...props}
    />
  )
);
ModalOverlay.displayName = 'ModalOverlay';

export interface ModalContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: ModalSize;
  /** Accessible label for the close button. */
  closeLabel?: string;
}

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, children, size = 'md', closeLabel = 'Close', ...props }, ref) => (
    <DialogPrimitive.Portal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={clsx(
          'fixed z-50 w-full rounded-xl border border-border bg-[hsl(var(--background-card))]',
          'shadow-xl shadow-black/40',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          sizeClasses[size],
          'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          focusRing,
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className={clsx(
            'absolute top-4 right-4 rounded-lg p-2 text-text-tertiary',
            'hover:bg-[hsl(var(--background-accent))] hover:text-text-primary',
            focusRing
          )}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
);
ModalContent.displayName = 'ModalContent';

const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={clsx('flex flex-col gap-2 border-b border-border px-6 py-4', className)}
    {...props}
  />
);
ModalHeader.displayName = 'ModalHeader';

const ModalTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={clsx('text-lg font-semibold text-text-primary', className)}
      {...props}
    />
  )
);
ModalTitle.displayName = 'ModalTitle';

const ModalDescription = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={clsx('text-sm text-text-secondary', className)}
      {...props}
    />
  )
);
ModalDescription.displayName = 'ModalDescription';

const ModalBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('px-6 py-4', className)} {...props} />
);
ModalBody.displayName = 'ModalBody';

const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={clsx('flex items-center justify-end gap-3 border-t border-border px-6 py-4', className)}
    {...props}
  />
);
ModalFooter.displayName = 'ModalFooter';

// Close button (re-export of Radix Close so consumers can place their own).
const ModalClose = DialogPrimitive.Close;

export {
  Modal,
  ModalTrigger,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
};

export default Modal;
