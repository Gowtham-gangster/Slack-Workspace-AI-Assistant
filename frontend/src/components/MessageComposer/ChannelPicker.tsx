import React from 'react';

interface Channel {
  id: string;
  name: string;
}

interface ChannelPickerProps {
  query: string;
  channels: Channel[];
  onSelect: (channelName: string, channelId: string) => void;
}

export default function ChannelPicker({ query, channels, onSelect }: ChannelPickerProps) {
  const getFilteredChannels = (): Channel[] => {
    if (!query) return channels.slice(0, 8);
    const q = query.toLowerCase();
    return channels
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  };

  const filtered = getFilteredChannels();

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-11 left-4 w-60 max-h-56 bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-y-auto z-50 p-2 animate-fadeIn" onClick={e => e.stopPropagation()}>
      <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/40 mb-1">Channel Mentions</div>
      {filtered.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.name, c.id)}
          className="w-full text-left p-1.5 hover:bg-secondary/40 rounded-lg flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold text-foreground/90"
        >
          <span className="text-primary font-bold shrink-0">#</span>
          <span className="truncate">{c.name}</span>
        </button>
      ))}
    </div>
  );
}
