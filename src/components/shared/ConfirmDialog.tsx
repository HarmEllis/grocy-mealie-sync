'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  itemNames?: string[];
  running?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description = 'This action cannot be undone.',
  itemNames,
  running = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={val => { if (!val && !running) onClose(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {itemNames && itemNames.length > 0 && (
          <ScrollArea className="max-h-[150px]">
            <div className="rounded-md border bg-muted/50 p-3">
              <ul className="list-disc pl-4 space-y-0.5 text-sm text-muted-foreground">
                {itemNames.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={running}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={running}>
            {running ? 'Running...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
