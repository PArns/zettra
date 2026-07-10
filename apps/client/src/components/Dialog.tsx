import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Input } from '../ui';
import { useT } from '../i18n';

interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOpts {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface DialogApi {
  /** Ask the user to confirm an action. Resolves true on confirm, false on cancel/dismiss. */
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  /** Ask the user for a line of text. Resolves the string on confirm, null on cancel/dismiss. */
  prompt: (opts: PromptOpts) => Promise<string | null>;
}

type Active =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: string | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

/**
 * App-wide promise-based confirm/prompt dialogs — a themed, keyboard-accessible replacement for
 * the native `window.confirm`/`window.prompt` (which render an unstyled OS chrome that clashes
 * with the app and can't be themed). Mirrors the {@link useToast} imperative-API pattern.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [active, setActive] = useState<Active | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setActive({ kind: 'confirm', opts, resolve })),
    [],
  );

  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? '');
        setActive({ kind: 'prompt', opts, resolve });
      }),
    [],
  );

  const cancel = useCallback(() => {
    setActive((a) => {
      if (a?.kind === 'confirm') a.resolve(false);
      else if (a?.kind === 'prompt') a.resolve(null);
      return null;
    });
  }, []);

  const accept = useCallback(() => {
    setActive((a) => {
      if (!a) return null;
      if (a.kind === 'confirm') a.resolve(true);
      else a.resolve(value);
      return null;
    });
  }, [value]);

  // Focus (and select, for edit-in-place) the field as soon as a prompt opens.
  useEffect(() => {
    if (active?.kind === 'prompt') {
      const id = window.setTimeout(() => inputRef.current?.select(), 0);
      return () => window.clearTimeout(id);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, cancel]);

  const opts = active?.opts;

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {active && opts && (
        <div className="modal-backdrop" onMouseDown={cancel}>
          <form
            className="modal dialog"
            role="dialog"
            aria-modal="true"
            aria-label={opts.title}
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              accept();
            }}
          >
            <div className="dialog-body">
              <div className="dialog-title">{opts.title}</div>
              {opts.message && <p className="dialog-message">{opts.message}</p>}
              {active.kind === 'prompt' && (
                <Input
                  ref={inputRef}
                  value={value}
                  placeholder={active.opts.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <div className="dialog-foot">
              <Button type="button" variant="ghost" onClick={cancel}>
                {opts.cancelLabel ?? t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant={active.kind === 'confirm' && active.opts.danger ? 'danger' : 'primary'}
                disabled={active.kind === 'prompt' && !value.trim()}
              >
                {opts.confirmLabel ?? t('common.confirm')}
              </Button>
            </div>
          </form>
        </div>
      )}
    </DialogContext.Provider>
  );
}

/**
 * Access the confirm/prompt dialog channel. Falls back to the native dialogs when used outside a
 * provider (e.g. in tests) so behavior degrades gracefully rather than throwing.
 */
export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  return (
    ctx ?? {
      confirm: async (o) => window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title),
      prompt: async (o) => window.prompt(o.title, o.defaultValue ?? ''),
    }
  );
}
