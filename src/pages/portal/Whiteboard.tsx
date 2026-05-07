import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PText, PIcon, PHeading } from '@/components/ui/porsche';

// ——— Constants ————————————————————————————————————————————————————————————————

const FONT = "'Montserrat', 'Arial Narrow', Arial, sans-serif";
const DEBOUNCE_MS = 500;

interface WhiteboardNote {
  id: string;
  user_id: string;
  content: string;
  updated_at: string;
}

// ——— Toolbar actions ——————————————————————————————————————————————————————————

type FormatAction = 'bold' | 'italic' | 'h1' | 'h2' | 'ul';

function applyFormat(text: string, selStart: number, selEnd: number, action: FormatAction): string {
  const before = text.slice(0, selStart);
  const selected = text.slice(selStart, selEnd);
  const after = text.slice(selEnd);

  switch (action) {
    case 'bold':
      return `${before}**${selected || 'bold text'}**${after}`;
    case 'italic':
      return `${before}_${selected || 'italic text'}_${after}`;
    case 'h1': {
      // If cursor is on a line, prepend # to that line
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineBefore = text.slice(0, lineStart);
      const lineContent = before.slice(lineStart) + selected + after;
      const firstLine = lineContent.split('\n')[0];
      const rest = lineContent.slice(firstLine.length);
      const stripped = firstLine.replace(/^#{1,6}\s?/, '');
      return `${lineBefore}# ${stripped}${rest}`;
    }
    case 'h2': {
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineBefore = text.slice(0, lineStart);
      const lineContent = before.slice(lineStart) + selected + after;
      const firstLine = lineContent.split('\n')[0];
      const rest = lineContent.slice(firstLine.length);
      const stripped = firstLine.replace(/^#{1,6}\s?/, '');
      return `${lineBefore}## ${stripped}${rest}`;
    }
    case 'ul': {
      // Toggle list item on each selected line
      const lines = selected
        ? selected.split('\n').map(l => (l.startsWith('- ') ? l.slice(2) : `- ${l}`)).join('\n')
        : '- list item';
      return `${before}${lines}${after}`;
    }
    default:
      return text;
  }
}

// ——— Toolbar Button ———————————————————————————————————————————————————————————

interface ToolbarBtnProps {
  label: string;
  title: string;
  onClick: () => void;
}

function ToolbarBtn({ label, title, onClick }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold text-contrast-medium border border-contrast-low bg-canvas hover:bg-surface hover:text-primary hover:border-primary transition-colors select-none"
      style={{ fontFamily: FONT }}
    >
      {label}
    </button>
  );
}

// ——— Save status indicator ————————————————————————————————————————————————————

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;

  const configs: Record<Exclude<SaveStatus, 'idle'>, { icon: Parameters<typeof PIcon>[0]['name']; color: Parameters<typeof PIcon>[0]['color']; label: string }> = {
    saving: { icon: 'refresh', color: 'contrast-medium', label: 'Saving…' },
    saved: { icon: 'check', color: 'notification-success', label: 'Saved' },
    error: { icon: 'error', color: 'notification-error', label: 'Save failed' },
  };

  const cfg = configs[status as Exclude<SaveStatus, 'idle'>];

  return (
    <div className="flex items-center gap-1.5">
      <PIcon name={cfg.icon} size="x-small" color={cfg.color} />
      <PText size="x-small" color={status === 'error' ? 'notification-error' : 'contrast-medium'} style={{ fontFamily: FONT }}>
        {cfg.label}
      </PText>
    </div>
  );
}

// ——— Preview renderer (simple markdown to HTML) ———————————————————————————————

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:0.75em 0 0.25em">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.15rem;font-weight:700;margin:0.75em 0 0.25em">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.35rem;font-weight:800;margin:0.75em 0 0.25em">$1</h1>')
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // List items
    .replace(/^- (.+)$/gm, '<li style="margin-left:1.25em;list-style-type:disc">$1</li>')
    // Line breaks
    .replace(/\n/g, '<br />');
}

// ——— Main Component ———————————————————————————————————————————————————————————

export default function Whiteboard() {
  const { profile } = useAuth();

  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loading, setLoading] = useState(true);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ——— Load note on mount ———————————————————————————————————————————————————

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('whiteboard_notes')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (data) {
        const note = data as WhiteboardNote;
        setNoteId(note.id);
        setContent(note.content || '');
        setWordCount(countWords(note.content || ''));
      }
      setLoading(false);
    })();
  }, [profile]);

  // ——— Helpers ——————————————————————————————————————————————————————————————

  function countWords(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  // ——— Debounced auto-save —————————————————————————————————————————————————

  const saveNote = useCallback(
    async (text: string) => {
      if (!profile) return;
      setSaveStatus('saving');
      const now = new Date().toISOString();

      let err = null;

      if (noteId) {
        const { error } = await supabase
          .from('whiteboard_notes')
          .update({ content: text, updated_at: now })
          .eq('id', noteId);
        err = error;
      } else {
        const { data, error } = await supabase
          .from('whiteboard_notes')
          .insert({ user_id: profile.id, content: text, updated_at: now })
          .select()
          .single();
        err = error;
        if (!error && data) setNoteId((data as WhiteboardNote).id);
      }

      setSaveStatus(err ? 'error' : 'saved');
      // Reset to idle after 3s
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
    [profile, noteId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setWordCount(countWords(val));
    setSaveStatus('saving');

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveNote(val);
    }, DEBOUNCE_MS);
  };

  // ——— Format toolbar ———————————————————————————————————————————————————————

  const handleFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = applyFormat(content, start, end, action);
    setContent(newText);
    setWordCount(countWords(newText));

    // Trigger debounced save
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveNote(newText);
    }, DEBOUNCE_MS);

    // Restore focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start);
    }, 0);
  };

  // ——— Render ———————————————————————————————————————————————————————————————

  return (
    <div className="max-w-5xl mx-auto" style={{ fontFamily: FONT }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">
            My Whiteboard
          </PHeading>
          <PText color="contrast-medium" style={{ fontFamily: FONT }}>
            Private workspace — only you can see this
          </PText>
        </div>
        <div className="flex items-center gap-4">
          <SaveIndicator status={saveStatus} />
          <button
            type="button"
            onClick={() => setShowPreview(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              showPreview
                ? 'bg-primary text-background-base border-primary'
                : 'bg-canvas border-contrast-low text-contrast-medium hover:text-primary hover:border-primary'
            }`}
            style={{ fontFamily: FONT }}
          >
            <PIcon
              name={showPreview ? 'close' : 'document'}
              size="x-small"
              color="inherit"
            />
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Editor card */}
      <div className="bg-surface rounded-2xl border border-contrast-low overflow-hidden">
        {/* Toolbar */}
        {!showPreview && (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-contrast-low bg-canvas flex-wrap">
            <ToolbarBtn label="B" title="Bold (**text**)" onClick={() => handleFormat('bold')} />
            <ToolbarBtn label="I" title="Italic (_text_)" onClick={() => handleFormat('italic')} />
            <div className="w-px h-6 bg-contrast-low mx-1" />
            <ToolbarBtn label="H1" title="Heading 1" onClick={() => handleFormat('h1')} />
            <ToolbarBtn label="H2" title="Heading 2" onClick={() => handleFormat('h2')} />
            <div className="w-px h-6 bg-contrast-low mx-1" />
            <ToolbarBtn label="·—" title="Bullet list" onClick={() => handleFormat('ul')} />
            <div className="ml-auto flex items-center gap-2">
              <PText size="xx-small" color="contrast-low" style={{ fontFamily: FONT }}>
                Markdown formatting
              </PText>
              <PIcon name="information" size="x-small" color="contrast-low" />
            </div>
          </div>
        )}

        {/* Content area */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <PText color="contrast-medium" style={{ fontFamily: FONT }}>
              Loading your notes…
            </PText>
          </div>
        ) : showPreview ? (
          <div
            className="min-h-[480px] p-6 text-primary leading-relaxed"
            style={{ fontFamily: FONT, fontSize: '0.95rem' }}
            dangerouslySetInnerHTML={{
              __html: content
                ? renderMarkdown(content)
                : '<span style="color:var(--p-color-contrast-low);font-style:italic">Nothing here yet — switch to Edit mode and start writing.</span>',
            }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            placeholder={`Start writing your notes here…\n\nYou can use Markdown:\n• **bold**, _italic_\n• # Heading 1, ## Heading 2\n• - bullet list items\n\nAuto-saves every 500ms.`}
            className="w-full min-h-[480px] p-6 bg-transparent resize-none focus:outline-none text-primary placeholder:text-contrast-low leading-relaxed"
            style={{ fontFamily: FONT, fontSize: '0.95rem', lineHeight: '1.75' }}
            spellCheck
          />
        )}

        {/* Footer bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-contrast-low bg-canvas">
          <PText size="xx-small" color="contrast-low" style={{ fontFamily: FONT }}>
            {wordCount} word{wordCount !== 1 ? 's' : ''} · {content.length} characters
          </PText>
          <div className="flex items-center gap-2">
            <PIcon name="lock" size="x-small" color="contrast-low" />
            <PText size="xx-small" color="contrast-low" style={{ fontFamily: FONT }}>
              Private — auto-saves to your account
            </PText>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="mt-4 flex items-start gap-2 px-2">
        <PIcon name="information" size="x-small" color="contrast-low" />
        <PText size="xx-small" color="contrast-low" style={{ fontFamily: FONT }}>
          Your whiteboard automatically saves changes. Use the Preview button to see rendered Markdown.
          This note is completely private and only visible to you.
        </PText>
      </div>
    </div>
  );
}



