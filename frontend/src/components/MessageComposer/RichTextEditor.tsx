import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Link as LinkIcon, Paperclip, Mic, Send, Smile } from 'lucide-react';
import { tiptapJsonToMrkdwn } from './SlackMrkdwnParser';
import EmojiPicker from './EmojiPicker';
import MentionPicker from './MentionPicker';
import ChannelPicker from './ChannelPicker';

interface Channel {
  id: string;
  name: string;
}

interface RichTextEditorProps {
  channelId: string;
  channels: Channel[];
  users: Record<string, any>;
  posting: boolean;
  onSend: (text: string) => void;
  attachments: any[];
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRecording: boolean;
  recordDuration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRemoveAttachment?: (id: string) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export default function RichTextEditor({
  channelId,
  channels = [],
  users = {},
  posting,
  onSend,
  attachments,
  onFileInputChange,
  isRecording,
  recordDuration,
  onStartRecording,
  onStopRecording,
  onRemoveAttachment,
  onPaste
}: RichTextEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<{ type: '@' | '#'; query: string; index: number } | null>(null);
  
  // Autocomplete emoji
  const [emojiQuery, setEmojiQuery] = useState<{ query: string; index: number } | null>(null);
  const [emojiSuggestions, setEmojiSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  // Link Dialog popup
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkForm, setLinkForm] = useState({ url: '', display: '' });

  const [editorStateToken, setEditorStateToken] = useState(0);

  const currentChannelName = channels.find(c => c.id === channelId)?.name || 'channel';

  const channelIdRef = useRef(channelId);
  useEffect(() => {
    channelIdRef.current = channelId;
  }, [channelId]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'slack-link',
        },
      }),
      Placeholder.configure({
        placeholder: `Message #${currentChannelName}...`,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[92px] p-3.5 text-xs text-foreground bg-transparent w-full focus:outline-none select-text prose dark:prose-invert max-w-none slack-tiptap-editor',
      },
      handleDOMEvents: {
        paste: (view, event) => {
          const items = event.clipboardData?.items;
          const files: File[] = [];
          if (items) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) files.push(file);
              }
            }
          }
          if (files.length > 0) {
            event.preventDefault();
            if (onPaste) {
              onPaste(event as any);
            }
            return true;
          }
          return false;
        }
      }
    },
    onSelectionUpdate: () => {
      setEditorStateToken(prev => prev + 1);
    },
    onUpdate: ({ editor }) => {
      setEditorStateToken(prev => prev + 1);
      const currentChanId = channelIdRef.current;
      if (!currentChanId) return;
      const json = editor.getJSON();
      localStorage.setItem(`slack_draft_json_${currentChanId}`, JSON.stringify(json));

      // Handle caret triggers for mentions
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - 20), $from.parentOffset, undefined, '\uFFFC');

      const atMatch = textBefore.match(/@(\w*)$/);
      const hashMatch = textBefore.match(/#(\w*)$/);
      const emojiMatch = textBefore.match(/:([a-zA-Z0-9_-]*)$/);

      if (atMatch) {
        setMentionQuery({ type: '@', query: atMatch[1], index: $from.pos - atMatch[0].length });
        setEmojiQuery(null);
      } else if (hashMatch) {
        setMentionQuery({ type: '#', query: hashMatch[1], index: $from.pos - hashMatch[0].length });
        setEmojiQuery(null);
      } else if (emojiMatch) {
        const query = emojiMatch[1];
        setEmojiQuery({ query, index: $from.pos - emojiMatch[0].length });
        setMentionQuery(null);

        const allSuggestions = ['smile', 'thumbsup', 'heart', 'fire', 'clap', 'tada', 'rocket', 'eyes', 'warning', 'check', 'laughing', 'cry', 'ok_hand'];
        const filtered = allSuggestions.filter(s => s.startsWith(query.toLowerCase())).slice(0, 5);
        setEmojiSuggestions(filtered);
        setSelectedSuggestionIndex(0);
      } else {
        setMentionQuery(null);
        setEmojiQuery(null);
      }
    }
  }, []);

  // Load drafts on channel change
  useEffect(() => {
    if (!editor || editor.isDestroyed || !channelId) return;
    try {
      const savedDraft = localStorage.getItem(`slack_draft_json_${channelId}`);
      if (savedDraft) {
        try {
          editor.commands.setContent(JSON.parse(savedDraft));
        } catch (e) {
          editor.commands.setContent('');
        }
      } else {
        editor.commands.setContent('');
      }
    } catch (e) {
      console.warn('TipTap commands not ready yet inside useEffect:', e);
    }
  }, [channelId, editor]);

  // Autocomplete key binds
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editor) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setMentionQuery(null);
      setEmojiQuery(null);
      setShowEmojiPicker(false);
      setShowLinkPopup(false);
      return;
    }

    if ((mentionQuery || emojiQuery) && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
      if (emojiQuery && emojiSuggestions.length > 0) {
        e.preventDefault();
        if (e.key === 'ArrowDown') {
          setSelectedSuggestionIndex(prev => (prev + 1) % emojiSuggestions.length);
        } else if (e.key === 'ArrowUp') {
          setSelectedSuggestionIndex(prev => (prev - 1 + emojiSuggestions.length) % emojiSuggestions.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          selectEmojiAlias(emojiSuggestions[selectedSuggestionIndex]);
        }
        return;
      }
    }

    // Submit on Enter without shift
    if (e.key === 'Enter' && !e.shiftKey) {
      if (mentionQuery || emojiQuery) return;
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!editor) return;
    const json = editor.getJSON();
    
    // Check if editor actually has content
    const plainText = editor.getText().trim();
    if (!plainText && attachments.length === 0) return;

    // Convert ProseMirror JSON state to clean Slack mrkdwn
    const mrkdwn = tiptapJsonToMrkdwn(json);
    onSend(mrkdwn);

    // Reset editor
    editor.commands.clearContent();
    if (channelId) {
      localStorage.removeItem(`slack_draft_json_${channelId}`);
    }
  };

  const selectMention = (name: string, id: string) => {
    if (!editor || !mentionQuery) return;
    
    editor.chain()
      .focus()
      .deleteRange({ from: mentionQuery.index, to: editor.state.selection.$from.pos })
      .setLink({ href: mentionQuery.type === '@' ? `mention://user/${id}` : `mention://channel/${id}` })
      .insertContent(mentionQuery.type === '@' ? `@${name}` : `#${name}`)
      .unsetLink()
      .insertContent(' ')
      .run();

    setMentionQuery(null);
  };

  const selectEmojiAlias = (alias: string) => {
    if (!editor || !emojiQuery) return;

    const emojiMap: Record<string, string> = {
      smile: '😊', thumbsup: '👍', heart: '❤️', fire: '🔥', clap: '👏',
      tada: '🎉', rocket: '🚀', eyes: '👀', warning: '⚠️', check: '✅',
      laughing: '😆', cry: '😢', ok_hand: '👌'
    };
    const emoji = emojiMap[alias] || `:${alias}:`;

    editor.chain()
      .focus()
      .deleteRange({ from: emojiQuery.index, to: editor.state.selection.$from.pos })
      .insertContent(emoji)
      .run();

    setEmojiQuery(null);
  };

  const handleSelectLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || !linkForm.url) return;

    const display = linkForm.display || linkForm.url;
    editor.chain()
      .focus()
      .setLink({ href: linkForm.url })
      .insertContent(display)
      .unsetLink()
      .run();

    setShowLinkPopup(false);
    setLinkForm({ url: '', display: '' });
  };

  const getButtonClass = (isActive: boolean) => {
    const base = "px-2.5 py-1 text-[11px] font-bold rounded-[10px] transition-transform duration-150 ease-in-out select-none flex items-center gap-1 focus:outline-none";
    if (isActive) {
      return `${base} text-white border-transparent hover:translate-y-[-1px] active-formatting-btn`;
    } else {
      return `${base} text-muted-foreground bg-transparent hover:bg-[#7C5CFF]/10 hover:text-foreground hover:translate-y-[-1px]`;
    }
  };

  const getButtonStyle = (isActive: boolean) => {
    if (isActive) {
      return {
        background: 'linear-gradient(135deg, #7C5CFF, #5B7CFF)',
        boxShadow: '0 0 18px rgba(124,92,255,.45)'
      };
    }
    return {};
  };

  if (!editor) return null;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-[#000000]/02 dark:bg-[#ffffff]/03 overflow-hidden relative">
      
      {/* 1. Editor Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/80 bg-secondary/5 text-muted-foreground text-xs shrink-0 select-none">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            aria-pressed={editor.isActive('bold') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={getButtonClass(editor.isActive('bold'))}
            style={getButtonStyle(editor.isActive('bold'))}
            title="Bold (Ctrl+B)"
          >
            <span className="font-extrabold">B</span>
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('italic') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={getButtonClass(editor.isActive('italic'))}
            style={getButtonStyle(editor.isActive('italic'))}
            title="Italic (Ctrl+I)"
          >
            <span className="italic font-bold">I</span>
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('underline') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={getButtonClass(editor.isActive('underline'))}
            style={getButtonStyle(editor.isActive('underline'))}
            title="Underline (Ctrl+U)"
          >
            <span className="underline font-bold">U</span>
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('strike') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={getButtonClass(editor.isActive('strike'))}
            style={getButtonStyle(editor.isActive('strike'))}
            title="Strike (Alt+Shift+5)"
          >
            <span className="line-through font-bold">S</span>
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('code') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={getButtonClass(editor.isActive('code'))}
            style={getButtonStyle(editor.isActive('code'))}
            title="Inline Code"
          >
            Code
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('codeBlock') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={getButtonClass(editor.isActive('codeBlock'))}
            style={getButtonStyle(editor.isActive('codeBlock'))}
            title="Code Block"
          >
            Block
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('blockquote') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={getButtonClass(editor.isActive('blockquote'))}
            style={getButtonStyle(editor.isActive('blockquote'))}
            title="Block Quote"
          >
            &gt;
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('bulletList') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={getButtonClass(editor.isActive('bulletList'))}
            style={getButtonStyle(editor.isActive('bulletList'))}
            title="Bulleted List"
          >
            • List
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('orderedList') ? "true" : "false"}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={getButtonClass(editor.isActive('orderedList'))}
            style={getButtonStyle(editor.isActive('orderedList'))}
            title="Ordered List"
          >
            1. List
          </button>
          <button
            type="button"
            aria-pressed={editor.isActive('link') ? "true" : "false"}
            onClick={() => setShowLinkPopup(true)}
            className={getButtonClass(editor.isActive('link'))}
            style={getButtonStyle(editor.isActive('link'))}
            title="Insert Link"
          >
            <LinkIcon className="w-3 h-3" /> Link
          </button>

          {/* Mention & Channel Mention Autocomplete shortcuts */}
          <button
            type="button"
            aria-pressed={mentionQuery?.type === '@' ? "true" : "false"}
            onClick={() => {
              editor.chain().focus().insertContent('@').run();
            }}
            className={getButtonClass(mentionQuery?.type === '@')}
            style={getButtonStyle(mentionQuery?.type === '@')}
            title="Mention User"
          >
            @
          </button>
          <button
            type="button"
            aria-pressed={mentionQuery?.type === '#' ? "true" : "false"}
            onClick={() => {
              editor.chain().focus().insertContent('#').run();
            }}
            className={getButtonClass(mentionQuery?.type === '#')}
            style={getButtonStyle(mentionQuery?.type === '#')}
            title="Mention Channel"
          >
            #
          </button>
          
          <div className="h-4 w-px bg-border/80 mx-1" />

          {/* Attach file click trigger */}
          <label className="cursor-pointer p-1.5 rounded-[10px] transition-transform duration-150 ease-in-out hover:bg-[#7C5CFF]/10 text-muted-foreground/80 hover:text-foreground hover:translate-y-[-1px] flex items-center focus:outline-none" title="Attach file">
            <Paperclip className="w-3.5 h-3.5" />
            <input type="file" onChange={onFileInputChange} className="hidden" multiple />
          </label>

          {/* Voice recorder trigger */}
          <button
            type="button"
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`p-1.5 rounded-[10px] transition-transform duration-150 ease-in-out hover:bg-[#7C5CFF]/10 text-muted-foreground/80 hover:text-foreground hover:translate-y-[-1px] flex items-center gap-1 focus:outline-none ${isRecording ? 'text-red-400 animate-pulse bg-red-500/10' : ''}`}
            title={isRecording ? "Stop Recording" : "Record Voice Message"}
          >
            <Mic className="w-3.5 h-3.5" />
            {isRecording && <span className="text-[10px] font-bold">{recordDuration}s</span>}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={showEmojiPicker ? "true" : "false"}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={getButtonClass(showEmojiPicker)}
            style={getButtonStyle(showEmojiPicker)}
            title="Pick Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. TipTap Editor Content */}
      <div className="relative min-h-[92px] w-full flex bg-transparent" onKeyDown={handleKeyDown}>
        <EditorContent editor={editor} className="w-full focus:outline-none" />
      </div>

      {/* 3. Dropdowns & Modals */}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            editor.chain().focus().insertContent(emoji).run();
            setShowEmojiPicker(false);
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Mentions Picker */}
      {mentionQuery && mentionQuery.type === '@' && (
        <MentionPicker
          query={mentionQuery.query}
          users={users}
          onSelect={selectMention}
        />
      )}

      {/* Channel Picker */}
      {mentionQuery && mentionQuery.type === '#' && (
        <ChannelPicker
          query={mentionQuery.query}
          channels={channels}
          onSelect={selectMention}
        />
      )}

      {/* Inline Emoji Autocomplete Picker */}
      {emojiQuery && emojiSuggestions.length > 0 && (
        <div className="absolute bottom-11 left-4 w-48 bg-card border border-border shadow-2xl rounded-2xl p-2 z-50 flex flex-col gap-0.5 animate-fadeIn">
          <div className="px-2 py-1 text-[9px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/40 mb-1">Emoji Autocomplete</div>
          {emojiSuggestions.map((suggestion, idx) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => selectEmojiAlias(suggestion)}
              className={`w-full text-left px-2 py-1 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                idx === selectedSuggestionIndex ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-secondary/40 text-foreground/90'
              }`}
            >
              <span>:{suggestion}:</span>
            </button>
          ))}
        </div>
      )}

      {/* Hyperlink Popup Dialog */}
      {showLinkPopup && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" onClick={() => setShowLinkPopup(false)}>
          <form onSubmit={handleSelectLink} className="w-full max-w-sm bg-card border border-border p-5 rounded-2xl flex flex-col gap-4 shadow-2xl animate-scaleUp" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><LinkIcon className="w-4 h-4 text-primary" /> Insert Slack Hyperlink</h4>
              <button type="button" onClick={() => setShowLinkPopup(false)} className="text-xs text-muted-foreground hover:text-foreground font-semibold">Cancel</button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Display Text</label>
              <input
                type="text"
                placeholder="optional (falls back to URL)"
                value={linkForm.display}
                onChange={e => setLinkForm({ ...linkForm, display: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-border bg-[#0f101a] outline-none text-xs text-white focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Link URL</label>
              <input
                type="url"
                required
                placeholder="https://example.com"
                value={linkForm.url}
                onChange={e => setLinkForm({ ...linkForm, url: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-border bg-[#0f101a] outline-none text-xs text-white focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-light transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_16px_rgba(124,106,247,0.3)]"
            >
              Insert Link
            </button>
          </form>
        </div>
      )}

      {/* 4. Synced attachments list preview */}
      {attachments.length > 0 && (
        <div className="p-3 border-t border-border/50 bg-secondary/5 flex flex-wrap gap-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 p-1.5 rounded-xl bg-card border border-border/40 text-[10px] font-semibold max-w-xs truncate relative group">
              <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate text-foreground/80">{att.name}</span>
              {onRemoveAttachment && (
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="text-red-400 hover:text-red-500 font-bold ml-1.5 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Float Send action trigger */}
      <div className="absolute bottom-2.5 right-3.5 z-20 flex items-center">
        <button
          type="button"
          onClick={handleSend}
          disabled={posting}
          className="p-1.5 rounded-xl bg-primary text-white hover:bg-primary-light disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-[0_4px_12px_rgba(124,106,247,0.25)] flex items-center justify-center shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Styles for TipTap ProseMirror list elements formatting */}
      <style jsx global>{`
        .slack-tiptap-editor {
          outline: none;
        }
        .slack-tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255, 255, 255, 0.4);
          pointer-events: none;
          height: 0;
        }
        .slack-tiptap-editor ul {
          list-style-type: disc !important;
          margin-left: 1.5rem !important;
          padding-left: 0 !important;
        }
        .slack-tiptap-editor ol {
          list-style-type: decimal !important;
          margin-left: 1.5rem !important;
          padding-left: 0 !important;
        }
        .slack-tiptap-editor li {
          margin-bottom: 2px;
        }
        .slack-tiptap-editor blockquote {
          border-left: 3px solid #7c6af7 !important;
          padding-left: 0.75rem !important;
          margin-left: 0.5rem !important;
          color: rgba(255, 255, 255, 0.6);
          font-style: italic;
        }
        .slack-tiptap-editor code {
          background: rgba(124, 106, 247, 0.15) !important;
          border-radius: 4px;
          padding: 1px 4px;
          font-family: monospace;
          color: #a78bfa;
        }
        .slack-tiptap-editor pre {
          background: rgba(124, 106, 247, 0.08) !important;
          border-radius: 6px;
          padding: 6px 10px;
          font-family: monospace;
          color: #a78bfa;
          margin: 4px 0;
          display: block;
        }
        .slack-tiptap-editor a.slack-link {
          background: rgba(124, 106, 247, 0.16) !important;
          border-radius: 4px;
          padding: 0 3px;
          color: #8b5cf6 !important;
          font-weight: bold;
          text-decoration: none !important;
        }
      `}</style>

    </div>
  );
}
