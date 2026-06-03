import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  Archive,
  ArrowLeft,
  Bold,
  Check,
  Eraser,
  CheckCircle,
  ChevronDown,
  FileText,
  Highlighter,
  Italic,
  MoreHorizontal,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Underline,
} from 'lucide-react';

const DEBOUNCE_MS = 650;

interface WhiteboardNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  content_html: string;
  plain_text: string;
  is_archived: boolean;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ConfirmDialogState {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'default' | 'danger';
  onConfirm: () => Promise<void> | void;
}

const TEXT_COLORS = ['#111827', '#603B2A', '#555D3A', '#2563EB', '#DC2626'];
const HIGHLIGHT_COLORS = ['#FEF3C7', '#DCFCE7', '#DBEAFE', '#FCE7F3'];

function getPlainTextFromHtml(html: string) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.textContent?.trim() || '';
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatUpdatedAt(value: string) {
  if (!value) return 'Not saved yet';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;

  const config = {
    saving: {
      icon: RefreshCw,
      label: 'Saving...',
      className: 'text-muted-foreground',
    },
    saved: {
      icon: CheckCircle,
      label: 'Saved',
      className: 'text-emerald-600 dark:text-emerald-300',
    },
    error: {
      icon: AlertTriangle,
      label: 'Save failed',
      className: 'text-destructive',
    },
  }[status];

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${config.className}`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </div>
  );
}

function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

export default function Whiteboard() {
  const { profile, departments } = useAuth();
  const portalEyebrow = departments.find(department => profile?.department_ids?.includes(department.id))?.name ?? 'Gravium OS';

  const [notes, setNotes] = useState<WhiteboardNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteSection, setNoteSection] = useState<'active' | 'archived'>('active');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState('');
  const [isColorPanelOpen, setIsColorPanelOpen] = useState(false);
  const [isHighlightPanelOpen, setIsHighlightPanelOpen] = useState(false);
  const [selectedTextColor, setSelectedTextColor] = useState(TEXT_COLORS[0]);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const [isNoteActionsOpen, setIsNoteActionsOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedNoteIdRef = useRef<string>('');
  const savedSelectionRef = useRef<Range | null>(null);

  const activeNote = notes.find(note => note.id === activeNoteId) || null;

  const fetchNotes = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('whiteboard_notes')
      .select('*')
      .eq('user_id', profile.id)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const fetchedNotes = (data as WhiteboardNote[]) || [];
    setNotes(fetchedNotes);
    setSelectedNoteIds(new Set());

    if (fetchedNotes.length > 0) {
      const firstNote = fetchedNotes[0];
      setActiveNoteId(firstNote.id);
      setTitle(firstNote.title || 'Untitled Note');
      const plainText = firstNote.plain_text || getPlainTextFromHtml(firstNote.content_html || firstNote.content || '');
      setWordCount(countWords(plainText));
      setCharacterCount(plainText.length);
    } else {
      setActiveNoteId('');
      setTitle('');
      setWordCount(0);
      setCharacterCount(0);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (!editorRef.current) return;

    if (!activeNote) {
      editorRef.current.innerHTML = '';
      loadedNoteIdRef.current = '';
      setWordCount(0);
      setCharacterCount(0);
      return;
    }

    if (loadedNoteIdRef.current === activeNote.id) return;

    const html = activeNote.content_html || activeNote.content || '';
    editorRef.current.innerHTML = html;
    loadedNoteIdRef.current = activeNote.id;

    const plainText = activeNote.plain_text || getPlainTextFromHtml(html);
    setWordCount(countWords(plainText));
    setCharacterCount(plainText.length);
  }, [activeNoteId]);

  const updateNotesList = useCallback((noteId: string, nextTitle: string, html: string, plainText: string) => {
    const updatedAt = new Date().toISOString();

    setNotes(current =>
      current.map(note =>
        note.id === noteId
          ? {
              ...note,
              title: nextTitle,
              content: html,
              content_html: html,
              plain_text: plainText,
              updated_at: updatedAt,
            }
          : note,
      ),
    );
  }, []);

  const saveActiveNote = useCallback(
    async (noteId: string, nextTitle: string, html: string, plainText: string) => {
      setSaveStatus('saving');

      const safeTitle = nextTitle.trim() || 'Untitled Note';

      const { error: saveError } = await supabase
        .from('whiteboard_notes')
        .update({
          title: safeTitle,
          content: html,
          content_html: html,
          plain_text: plainText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .eq('user_id', profile?.id);

      if (saveError) {
        setSaveStatus('error');
        setError(saveError.message);
        return;
      }

      updateNotesList(noteId, safeTitle, html, plainText);
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1800);
    },
    [profile?.id, updateNotesList],
  );

  const scheduleSave = useCallback(
    (nextTitle = title) => {
      if (!activeNoteId || !editorRef.current) return;

      const html = editorRef.current.innerHTML;
      const plainText = editorRef.current.textContent?.trim() || '';

      setWordCount(countWords(plainText));
      setCharacterCount(plainText.length);
      setSaveStatus('saving');

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        saveActiveNote(activeNoteId, nextTitle, html, plainText);
      }, DEBOUNCE_MS);
    },
    [activeNoteId, saveActiveNote, title],
  );

  const createNote = async () => {
    if (!profile) return;

    const { data, error: createError } = await supabase
      .from('whiteboard_notes')
      .insert({
        user_id: profile.id,
        title: 'Untitled Note',
        content: '',
        content_html: '',
        plain_text: '',
      })
      .select('*')
      .single();

    if (createError) {
      setError(createError.message);
      return;
    }

    const note = data as WhiteboardNote;

    loadedNoteIdRef.current = '';
    setNotes(current => [note, ...current]);
    setActiveNoteId(note.id);
    setTitle(note.title);
    setIsMobileEditorOpen(true);
    setIsNoteActionsOpen(false);
    setWordCount(0);
    setCharacterCount(0);
    setSaveStatus('saved');
    window.setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const performArchiveNote = async () => {
    if (!activeNote || !profile) return;

    const { error: archiveError } = await supabase
      .from('whiteboard_notes')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeNote.id)
      .eq('user_id', profile.id);

    if (archiveError) {
      setError(archiveError.message);
      return;
    }

    setNotes(current =>
      current.map(note =>
        note.id === activeNote.id
          ? { ...note, is_archived: true, updated_at: new Date().toISOString() }
          : note,
      ),
    );

    const nextActiveNote = notes.find(note => note.id !== activeNote.id && !note.is_archived);

    if (nextActiveNote) {
      loadedNoteIdRef.current = '';
      setActiveNoteId(nextActiveNote.id);
      setTitle(nextActiveNote.title || 'Untitled Note');
    } else {
      setActiveNoteId('');
      setTitle('');
      if (editorRef.current) editorRef.current.innerHTML = '';
    }
  };

  const archiveNote = () => {
    if (!activeNote) return;

    setConfirmDialog({
      title: 'Archive note?',
      description: `"${activeNote.title || 'Untitled Note'}" will be hidden from Active Notes. You can restore it later from Archived.`,
      confirmLabel: 'Archive',
      tone: 'default',
      onConfirm: performArchiveNote,
    });
  };

  const performRestoreNote = async () => {
    if (!activeNote || !profile) return;

    const { error: restoreError } = await supabase
      .from('whiteboard_notes')
      .update({
        is_archived: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeNote.id)
      .eq('user_id', profile.id);

    if (restoreError) {
      setError(restoreError.message);
      return;
    }

    setNotes(current =>
      current.map(note =>
        note.id === activeNote.id
          ? { ...note, is_archived: false, updated_at: new Date().toISOString() }
          : note,
      ),
    );

    const nextArchivedNote = notes.find(note => note.id !== activeNote.id && note.is_archived);

    if (nextArchivedNote) {
      loadedNoteIdRef.current = '';
      setActiveNoteId(nextArchivedNote.id);
      setTitle(nextArchivedNote.title || 'Untitled Note');
    } else {
      setActiveNoteId('');
      setTitle('');
      if (editorRef.current) editorRef.current.innerHTML = '';
    }
  };

  const restoreNote = () => {
    if (!activeNote) return;

    setConfirmDialog({
      title: 'Restore note?',
      description: `"${activeNote.title || 'Untitled Note'}" will move back to Active Notes.`,
      confirmLabel: 'Restore',
      tone: 'default',
      onConfirm: performRestoreNote,
    });
  };

  const performDeleteNote = async () => {
    if (!activeNote || !profile) return;

    const { error: deleteError } = await supabase
      .from('whiteboard_notes')
      .delete()
      .eq('id', activeNote.id)
      .eq('user_id', profile.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const remainingNotes = notes.filter(note => note.id !== activeNote.id);
    const nextNote = remainingNotes.find(note =>
      noteSection === 'archived' ? note.is_archived : !note.is_archived,
    );

    setNotes(remainingNotes);

    if (nextNote) {
      loadedNoteIdRef.current = '';
      setActiveNoteId(nextNote.id);
      setTitle(nextNote.title || 'Untitled Note');
    } else {
      setActiveNoteId('');
      setTitle('');
      if (editorRef.current) editorRef.current.innerHTML = '';
    }
  };

  const deleteNote = () => {
    if (!activeNote) return;

    setConfirmDialog({
      title: 'Delete note permanently?',
      description: `"${activeNote.title || 'Untitled Note'}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: performDeleteNote,
    });
  };

  const selectNote = (note: WhiteboardNote) => {
    if (note.id !== activeNoteId) {
      loadedNoteIdRef.current = '';
    }

    setActiveNoteId(note.id);
    setTitle(note.title || 'Untitled Note');
    setSaveStatus('idle');
    setIsMobileEditorOpen(true);
    setIsNoteActionsOpen(false);
  };

  const saveEditorSelection = () => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;

    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editorRef.current.contains(anchorNode)) return;

    savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreEditorSelection = () => {
    editorRef.current?.focus();

    const selection = window.getSelection();
    if (!selection || !savedSelectionRef.current) return;

    selection.removeAllRanges();
    selection.addRange(savedSelectionRef.current);
  };

  const runCommand = (command: string, value?: string) => {
    restoreEditorSelection();
    document.execCommand(command, false, value);
    saveEditorSelection();
    scheduleSave();
  };

  const applyTextColor = (color: string) => {
    setSelectedTextColor(color);
    runCommand('foreColor', color);
  };

  const applyHighlightColor = (color: string) => {
    setSelectedHighlightColor(color);
    runCommand('backColor', color);
  };

  const clearHighlight = () => {
    setSelectedHighlightColor('');
    runCommand('backColor', 'transparent');
  };

  const handleEditorInput = (_event: FormEvent<HTMLDivElement>) => {
    saveEditorSelection();
    scheduleSave();
  };

  const activeNotesCount = notes.filter(note => !note.is_archived).length;
  const archivedNotesCount = notes.filter(note => note.is_archived).length;

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(current => {
      const next = new Set(current);

      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }

      return next;
    });
  };

  const clearSelection = () => {
    setSelectedNoteIds(new Set());
  };

  const getSelectedNotesForSection = () =>
    notes.filter(note => {
      const matchesSection = noteSection === 'archived' ? note.is_archived : !note.is_archived;
      return matchesSection && selectedNoteIds.has(note.id);
    });

  const selectedSectionNotes = getSelectedNotesForSection();
  const selectedSectionCount = selectedSectionNotes.length;
  const toggleSelectAllVisible = () => {
    setSelectedNoteIds(current => {
      const next = new Set(current);

      if (allVisibleSelected) {
        selectableSectionNoteIds.forEach(noteId => next.delete(noteId));
      } else {
        selectableSectionNoteIds.forEach(noteId => next.add(noteId));
      }

      return next;
    });
  };

  const performArchiveSelectedNotes = async () => {
    if (!profile) return;

    const selectedNotes = getSelectedNotesForSection();
    if (selectedNotes.length === 0) return;

    const selectedIds = selectedNotes.map(note => note.id);
    const updatedAt = new Date().toISOString();

    const { error: archiveError } = await supabase
      .from('whiteboard_notes')
      .update({
        is_archived: true,
        updated_at: updatedAt,
      })
      .in('id', selectedIds)
      .eq('user_id', profile.id);

    if (archiveError) {
      setError(archiveError.message);
      return;
    }

    setNotes(current =>
      current.map(note =>
        selectedIds.includes(note.id)
          ? { ...note, is_archived: true, updated_at: updatedAt }
          : note,
      ),
    );

    if (activeNoteId && selectedIds.includes(activeNoteId)) {
      const nextActiveNote = notes.find(note => !selectedIds.includes(note.id) && !note.is_archived);

      if (nextActiveNote) {
        loadedNoteIdRef.current = '';
        setActiveNoteId(nextActiveNote.id);
        setTitle(nextActiveNote.title || 'Untitled Note');
      } else {
        setActiveNoteId('');
        setTitle('');
        if (editorRef.current) editorRef.current.innerHTML = '';
      }
    }

    clearSelection();
  };

  const archiveSelectedNotes = () => {
    const selectedNotes = getSelectedNotesForSection();
    if (selectedNotes.length === 0) return;

    setConfirmDialog({
      title: 'Archive selected notes?',
      description: `${selectedNotes.length} selected note${selectedNotes.length === 1 ? '' : 's'} will be moved to Archived. You can restore them later.`,
      confirmLabel: 'Archive',
      tone: 'default',
      onConfirm: performArchiveSelectedNotes,
    });
  };

  const performRestoreSelectedNotes = async () => {
    if (!profile) return;

    const selectedNotes = getSelectedNotesForSection();
    if (selectedNotes.length === 0) return;

    const selectedIds = selectedNotes.map(note => note.id);
    const updatedAt = new Date().toISOString();

    const { error: restoreError } = await supabase
      .from('whiteboard_notes')
      .update({
        is_archived: false,
        updated_at: updatedAt,
      })
      .in('id', selectedIds)
      .eq('user_id', profile.id);

    if (restoreError) {
      setError(restoreError.message);
      return;
    }

    setNotes(current =>
      current.map(note =>
        selectedIds.includes(note.id)
          ? { ...note, is_archived: false, updated_at: updatedAt }
          : note,
      ),
    );

    if (activeNoteId && selectedIds.includes(activeNoteId)) {
      const nextArchivedNote = notes.find(note => !selectedIds.includes(note.id) && note.is_archived);

      if (nextArchivedNote) {
        loadedNoteIdRef.current = '';
        setActiveNoteId(nextArchivedNote.id);
        setTitle(nextArchivedNote.title || 'Untitled Note');
      } else {
        setActiveNoteId('');
        setTitle('');
        if (editorRef.current) editorRef.current.innerHTML = '';
      }
    }

    clearSelection();
  };

  const restoreSelectedNotes = () => {
    const selectedNotes = getSelectedNotesForSection();
    if (selectedNotes.length === 0) return;

    setConfirmDialog({
      title: 'Restore selected notes?',
      description: `${selectedNotes.length} selected note${selectedNotes.length === 1 ? '' : 's'} will move back to Active Notes.`,
      confirmLabel: 'Restore',
      tone: 'default',
      onConfirm: performRestoreSelectedNotes,
    });
  };

  const performDeleteSelectedNotes = async () => {
    if (!profile) return;

    const selectedNotes = getSelectedNotesForSection();
    if (selectedNotes.length === 0) return;

    const selectedIds = selectedNotes.map(note => note.id);

    const { error: deleteError } = await supabase
      .from('whiteboard_notes')
      .delete()
      .in('id', selectedIds)
      .eq('user_id', profile.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const remainingNotes = notes.filter(note => !selectedIds.includes(note.id));
    setNotes(remainingNotes);

    if (activeNoteId && selectedIds.includes(activeNoteId)) {
      const nextNote = remainingNotes.find(note =>
        noteSection === 'archived' ? note.is_archived : !note.is_archived,
      );

      if (nextNote) {
        loadedNoteIdRef.current = '';
        setActiveNoteId(nextNote.id);
        setTitle(nextNote.title || 'Untitled Note');
      } else {
        setActiveNoteId('');
        setTitle('');
        if (editorRef.current) editorRef.current.innerHTML = '';
      }
    }

    clearSelection();
  };

  const deleteSelectedNotes = () => {
    const selectedNotes = getSelectedNotesForSection();
    if (selectedNotes.length === 0) return;

    setConfirmDialog({
      title: 'Delete selected notes permanently?',
      description: `${selectedNotes.length} selected note${selectedNotes.length === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: performDeleteSelectedNotes,
    });
  };

  const filteredNotes = notes.filter(note => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSection = noteSection === 'archived' ? note.is_archived : !note.is_archived;

    if (!matchesSection) return false;
    if (!query) return true;

    return (
      note.title.toLowerCase().includes(query) ||
      note.plain_text.toLowerCase().includes(query)
    );
  });

  const selectableSectionNoteIds = filteredNotes.map(note => note.id);
  const allVisibleSelected =
    selectableSectionNoteIds.length > 0 &&
    selectableSectionNoteIds.every(noteId => selectedNoteIds.has(noteId));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8 lg:pb-10">
      <div className="mb-8 border-b border-border pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              {portalEyebrow}
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Whiteboard
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Private notes, drafts, and working thoughts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SaveIndicator status={saveStatus} />
            <button
              type="button"
              onClick={createNote}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Note
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search notes"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => {
                  setNoteSection('active');
                  clearSelection();
                  setActiveNoteId('');
                  setTitle('');
                  setIsMobileEditorOpen(false);
                  setIsNoteActionsOpen(false);
                  if (editorRef.current) editorRef.current.innerHTML = '';
                }}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  noteSection === 'active'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Active ({activeNotesCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoteSection('archived');
                  clearSelection();
                  setActiveNoteId('');
                  setTitle('');
                  setIsMobileEditorOpen(false);
                  setIsNoteActionsOpen(false);
                  if (editorRef.current) editorRef.current.innerHTML = '';
                }}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  noteSection === 'archived'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Archived ({archivedNotesCount})
              </button>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                disabled={selectableSectionNoteIds.length === 0}
                className="text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {allVisibleSelected ? 'Deselect All' : 'Select All'}
              </button>

              {selectedSectionCount > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {selectedSectionCount > 0 && (
              <div className="mt-3 rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    {selectedSectionCount} selected
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    {noteSection === 'active' ? (
                      <button
                        type="button"
                        title="Archive selected"
                        aria-label="Archive selected notes"
                        onClick={archiveSelectedNotes}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="Restore selected"
                          aria-label="Restore selected notes"
                          onClick={restoreSelectedNotes}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete selected"
                          aria-label="Delete selected notes"
                          onClick={deleteSelectedNotes}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/30 bg-card text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-[18rem] overflow-y-auto p-2 lg:max-h-[calc(100vh-17rem)]">
            {loading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Loading notes...</p>
            ) : filteredNotes.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {noteSection === 'archived' ? 'No archived notes' : 'No notes found'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {noteSection === 'archived'
                    ? 'Archived notes will appear here.'
                    : 'Create a new note to start writing.'}
                </p>
              </div>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  className={`flex gap-2 rounded-xl px-2 py-2 transition-colors ${
                    activeNoteId === note.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.has(note.id)}
                    onChange={() => toggleNoteSelection(note.id)}
                    className="mt-1 h-4 w-4 rounded border-border"
                    aria-label={`Select ${note.title || 'Untitled Note'}`}
                  />
                  <button
                    type="button"
                    onClick={() => selectNote(note)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-semibold">
                      {note.title || 'Untitled Note'}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-xs">
                      {note.plain_text || 'Empty note'}
                    </span>
                    <span className="mt-2 block text-[11px] text-muted-foreground">
                      {formatUpdatedAt(note.updated_at)}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className={`${isMobileEditorOpen ? 'fixed inset-0 z-[70] block h-[100dvh] w-[100dvw] overflow-hidden rounded-none border-0' : 'hidden rounded-2xl'} border border-border bg-card text-card-foreground shadow-sm lg:static lg:z-auto lg:block lg:h-auto lg:w-auto lg:overflow-visible lg:rounded-2xl lg:border`}>
          {activeNote ? (
            <>
              <div className="border-b border-border px-3 py-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileEditorOpen(false);
                      setIsNoteActionsOpen(false);
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                    aria-label="Back to notes"
                    title="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <input
                    value={title}
                    onChange={event => {
                      const nextTitle = event.target.value;
                      setTitle(nextTitle);
                      scheduleSave(nextTitle);
                    }}
                    placeholder="Untitled Note"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-0 text-lg font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus:border-border focus:bg-background focus:px-3 sm:text-xl"
                  />

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      title="Note actions"
                      aria-label="Note actions"
                      onClick={() => setIsNoteActionsOpen(current => !current)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {isNoteActionsOpen && (
                      <div className="absolute right-0 top-12 z-[90] min-w-40 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
                        {activeNote.is_archived ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setIsNoteActionsOpen(false);
                                restoreNote();
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsNoteActionsOpen(false);
                                deleteNote();
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsNoteActionsOpen(false);
                              archiveNote();
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 overflow-visible sm:mt-4">
                  <ToolbarButton title="Bold" onClick={() => runCommand('bold')}>
                    <Bold className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title="Italic" onClick={() => runCommand('italic')}>
                    <Italic className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title="Underline" onClick={() => runCommand('underline')}>
                    <Underline className="h-4 w-4" />
                  </ToolbarButton>

                  <div className="mx-1 h-6 w-px bg-border" />

                  <ToolbarButton title="Align Left" onClick={() => runCommand('justifyLeft')}>
                    <AlignLeft className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title="Align Center" onClick={() => runCommand('justifyCenter')}>
                    <AlignCenter className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title="Align Right" onClick={() => runCommand('justifyRight')}>
                    <AlignRight className="h-4 w-4" />
                  </ToolbarButton>

                  <div className="mx-1 h-6 w-px bg-border" />

                  <div className="relative flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        setIsHighlightPanelOpen(false);
                        setIsColorPanelOpen(current => !current);
                      }}
                      className={`inline-flex h-9 w-12 items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors ${
                        isColorPanelOpen
                          ? 'border-foreground bg-muted text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      aria-label="Text color"
                      title="Text color"
                    >
                      <Palette className="h-4 w-4" />
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isColorPanelOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        setIsColorPanelOpen(false);
                        setIsHighlightPanelOpen(current => !current);
                      }}
                      className={`inline-flex h-9 w-12 items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors ${
                        isHighlightPanelOpen
                          ? 'border-foreground bg-muted text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      aria-label="Highlight color"
                      title="Highlight color"
                    >
                      <Highlighter className="h-4 w-4" />
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isHighlightPanelOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isColorPanelOpen && (
                      <div className="absolute left-0 top-11 z-[90] flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-1.5 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
                        {TEXT_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            title="Text color"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => {
                              applyTextColor(color);
                              setIsColorPanelOpen(false);
                            }}
                            className={`relative h-6 w-6 rounded-full border transition ${
                              selectedTextColor === color ? 'border-foreground ring-2 ring-foreground/20' : 'border-border'
                            }`}
                            style={{ backgroundColor: color }}
                          >
                            {selectedTextColor === color && (
                              <Check className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {isHighlightPanelOpen && (
                      <div className="absolute left-0 top-11 z-[90] flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-1.5 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
                        <button
                          type="button"
                          title="No highlight"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => {
                            clearHighlight();
                            setIsHighlightPanelOpen(false);
                          }}
                          className={`flex h-6 w-6 items-center justify-center rounded-full border bg-background transition ${
                            selectedHighlightColor === '' ? 'border-foreground ring-2 ring-foreground/20' : 'border-border'
                          }`}
                        >
                          <Eraser className="h-3 w-3 text-muted-foreground" />
                        </button>

                        {HIGHLIGHT_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            title="Highlight"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => {
                              applyHighlightColor(color);
                              setIsHighlightPanelOpen(false);
                            }}
                            className={`relative h-6 w-6 rounded-full border transition ${
                              selectedHighlightColor === color ? 'border-foreground ring-2 ring-foreground/20' : 'border-border'
                            }`}
                            style={{ backgroundColor: color }}
                          >
                            {selectedHighlightColor === color && (
                              <Check className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-foreground" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onMouseUp={saveEditorSelection}
                onKeyUp={saveEditorSelection}
                onFocus={saveEditorSelection}
                className="whiteboard-editor h-[calc(100dvh-13.5rem)] w-full overflow-x-hidden overflow-y-auto break-words px-3 py-4 text-base leading-7 text-foreground outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] sm:min-h-[32rem] sm:px-5 sm:py-5 lg:h-auto lg:min-h-[calc(100vh-23rem)]"
                data-placeholder="Start writing your note..."
              />

              <div className="border-t border-border bg-background px-3 py-2 text-xs text-muted-foreground sm:px-4">
                {wordCount} word{wordCount !== 1 ? 's' : ''} - {characterCount} characters
              </div>
            </>
          ) : (
            <div className="flex min-h-[28rem] flex-col items-center justify-center p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">No note selected</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create a new note or select an existing note from the list.
              </p>
              <button
                type="button"
                onClick={createNote}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New Note
              </button>
            </div>
          )}
        </section>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">{confirmDialog.title}</h2>
            </div>

            <div className="p-5">
              <p className="text-sm leading-6 text-muted-foreground">{confirmDialog.description}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = confirmDialog.onConfirm;
                    setConfirmDialog(null);
                    await action();
                  }}
                  className={`inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors ${
                    confirmDialog.tone === 'danger'
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
