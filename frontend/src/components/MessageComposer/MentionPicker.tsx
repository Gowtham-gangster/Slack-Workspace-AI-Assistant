import React from 'react';

interface User {
  id: string;
  name: string;
  realName?: string;
  avatar?: string;
  email?: string;
  statusText?: string;
}

interface MentionPickerProps {
  query: string;
  users: Record<string, any>;
  onSelect: (displayName: string, userId: string) => void;
}

export default function MentionPicker({ query, users, onSelect }: MentionPickerProps) {
  const getFilteredUsers = (): User[] => {
    const list: User[] = Object.keys(users).map(id => ({
      id,
      name: users[id].name || '',
      realName: users[id].realName || users[id].name || '',
      avatar: users[id].avatar || '',
      email: users[id].email || '',
      statusText: users[id].statusText || ''
    }));

    if (!query) return list.slice(0, 8);
    const q = query.toLowerCase();
    return list
      .filter(u => u.name.toLowerCase().includes(q) || (u.realName && u.realName.toLowerCase().includes(q)))
      .slice(0, 8);
  };

  const filtered = getFilteredUsers();

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-11 left-4 w-60 max-h-56 bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-y-auto z-50 p-2 animate-fadeIn" onClick={e => e.stopPropagation()}>
      <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/40 mb-1">User Mentions</div>
      {filtered.map(u => (
        <button
          key={u.id}
          type="button"
          onClick={() => onSelect(u.realName || u.name || u.id, u.id)}
          className="w-full text-left p-1.5 hover:bg-secondary/40 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer"
        >
          {u.avatar ? (
            <img src={u.avatar} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
              {u.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <span className="text-xs font-semibold truncate text-foreground/90">{u.realName || u.name}</span>
            {u.email && <span className="text-[9px] text-muted-foreground truncate">{u.email}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
