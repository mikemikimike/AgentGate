import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function Drawer({ open, onOpenChange, title, children }: { open: boolean, onOpenChange: (o: boolean) => void, title: string, children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 transition-opacity" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 w-[600px] bg-bg border-l border-border flex flex-col shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
          <div className="flex items-center justify-between p-24 border-b border-border shrink-0">
            <Dialog.Title className="text-[16px] font-semibold">{title}</Dialog.Title>
            <Dialog.Close 
              aria-label="Close drawer"
              className="text-text-muted hover:text-text focus:outline-hidden focus-visible:ring-2 focus-visible:ring-at rounded-controls p-4"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-24">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
