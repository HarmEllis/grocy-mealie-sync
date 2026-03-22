'use client';

import * as Dialog from '@radix-ui/react-dialog';

const btnSecondary: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.9rem', cursor: 'pointer',
  background: '#f3f4f6', color: '#333', border: '1px solid #d1d5db', borderRadius: 6,
};
const btnDanger: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.9rem', cursor: 'pointer',
  background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
};

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  /** Optional list of item names to display */
  itemNames?: string[];
  running?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description = 'This action cannot be undone.',
  itemNames,
  running = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={val => { if (!val && !running) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-dialog-overlay" />
        <Dialog.Content className="confirm-dialog-content" aria-describedby="confirm-desc">
          <Dialog.Title style={{ marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '1rem' }}>
            {title}
          </Dialog.Title>
          <p id="confirm-desc" style={{ marginBottom: '0.75rem', color: '#666', fontSize: '0.9rem' }}>
            {description}
          </p>
          {itemNames && itemNames.length > 0 && (
            <div style={{
              maxHeight: 150,
              overflow: 'auto',
              textAlign: 'left',
              margin: '0.5rem 0 1rem',
              padding: '0.5rem 0.75rem',
              background: '#f9fafb',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              fontSize: '0.85rem',
            }}>
              <ul style={{ margin: 0, padding: '0 0 0 1.25rem' }}>
                {itemNames.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
            <button style={btnSecondary} onClick={onClose} disabled={running}>
              Cancel
            </button>
            <button style={btnDanger} onClick={onConfirm} disabled={running}>
              {running ? 'Running...' : 'Confirm'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
