import React, { useState, useEffect } from 'react';
import { Smile, Heart, Leaf, Utensils, Plane, Trophy, Lightbulb, Flag, History, Search } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Recently Used',
    icon: History,
    emojis: [] as string[]
  },
  {
    name: 'Smileys & People',
    icon: Smile,
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🤫', '🤥', '😶', '😶‍🌫️', '😐', '😑', '😬', '🫨', '🫵', '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🙏', '✍️', '💅', '🤳', '💪', '🦾']
  },
  {
    name: 'Animals & Nature',
    icon: Leaf,
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🐙', '🦑', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', ' Flamingo', '🕊️', '🐇', '🦝', '🦡', '🦫', ' Otter', ' Sloth', '🐿️', '🦔', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '🍀', '🍁', '🍂', '🍃']
  },
  {
    name: 'Food & Drink',
    icon: Utensils,
    emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🍳', '🥘', '🍲', '🫕', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑', '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊']
  },
  {
    name: 'Travel & Places',
    icon: Plane,
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🛹', '🛼', '🚏', '🛣️', '🛤️', '⛽', '🚨', '🚥', '🚦', '🚧', '⚓', '⛵', '🚤', '🛳️', '⛴️', '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', '🚁', '🚟', '🚠', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '🚀', '🛸', '🛰️', '🛸', '⛺', '🏕️', '🏗️', '🏘️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', ' Synagogue', ' Shinto Shrine', ' Kaaba', '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉', '🎠', '🎡', '🎢', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️']
  },
  {
    name: 'Activities',
    icon: Trophy,
    emojis: ['👾', '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', ' Frisbee', '🛹', '🛼', '🎽', '🏏', '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳', '⛸️', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎯', '🪀', '🪁', '🎮', '🕹️', '🎰', '🎲', '🧩', '🎳', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '🎳', '🎭', '🎬', '🎟️', '🎫', '🎗️', '🏅', '🏆', '🎖️', '🏵️', '🎫']
  },
  {
    name: 'Objects',
    icon: Lightbulb,
    emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖱️', '🖨️', '🖥️', '🖲️', '💾', '💿', '📀', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '⏳', '⌛', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🗑️', '🪘', '💰', '🪙', '💵', '💴', '💶', '💷', '💸', '💳', '🧾', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬', '📭', '📮', '🗳️', '✏️', '✒️', '🖋️', '🖊️', '🖌️', '🖍️', '📝', '📁', '📂', '📅', '📆', '🗒️', '🗓️', '📖', '📕', '📗', '📘', '📙', '📓', '📒', '📝', '✉️', '📎', '🖇️', '✂️', '📐', '📏', '📌', '📍', '🔑', '🗝️', '🔨', '🛠️', '⛏️', '🔧', '🔩', '⚙️', '🧱', '🛡️', '⚔️', '🗡️', '🔫', '🪃', '🏹', '🏺', '🔮', '📿', '💈', '⚗️', '🔭', '🔬', '🕳️', '💊', '💉', '🩹', '🩺', '🔬', '🔭']
  },
  {
    name: 'Symbols',
    icon: Heart,
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🪯', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⛎', '🔀', '🔁', '🔂', '▶️', '⏩', '⏭️', '⏯️', '◀️', '⏪', '⏮️', '🔼', '🚀', '🔽', '🎦', '📶', '📳', '📴', '➕', '➖', '✖️', '➗', '♾️', '🟰', '❓', '❔', '❕', '❗', '〰️', '💱', '💲', '🔱', '📛', '🔰', '⭕', '✅', '☑️', '✔️', '❌', '❎', '➰', '➿', '〽️', '✳️', '✴️', '❇️', '💯', '🔠', '🔡', '🔢', '🔣', '🔤']
  },
  {
    name: 'Flags',
    icon: Flag,
    emojis: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹', '🇦🇺', '🇦🇼', '🇦🇽', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬', '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧🇸', '🇧🇹', '🇧🇻', '🇧🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨', '🇨🇩', '🇨🇫', '🇨🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '🇨🇳', '🇨🇴', '🇨🇵', '🇨🇷', '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽', '🇨🇾', '🇨🇿', '🇩🇪', '🇩🇬', '🇩🇯', '🇩🇰', '🇩🇲', '🇩🇴', '🇩🇿', '🇪🇦', '🇪🇨', '🇪🇪', '🇪🇬', '🇪🇭', '🇪🇷', '🇪🇸', '🇪🇹', '🇪🇺', '🇫🇮', '🇫🇯', '🇫🇰', '🇫🇲', '🇫🇴', '🇫🇷', '🇬🇦', '🇬🇧', '🇬🇩', '🇬🇪', '🇬🇫', '🇬🇬', '🇬🇭', '🇬🇮', '🇬🇱', '🇬🇲', '🇬🇳', '🇬🇵', '🇬🇶', '🇬🇷', '🇬🇸', '🇬🇹', '🇬🇺', '🇬🇼', '🇬🇾', '🇭🇰', '🇭🇲', '🇭🇳', '🇭🇷', '🇭🇹', '🇭🇺', '🇮🇨', '🇮🇩', '🇮🇪', '🇮🇱', '🇮🇲', '🇮🇳', '🇮🇴', '🇮🇶', '🇮🇷', '🇮🇸', '🇮🇹', '🇯🇪', '🇯🇲', '🇯🇴', '🇯🇵', '🇰🇪', '🇰🇬', '🇰🇭', '🇰🇮', '🇰🇲', '🇰🇳', '🇰🇵', '🇰🇷', '🇰🇼', '🇰🇾', '🇰🇿', '🇱🇦', '🇱🇧', '🇱🇨', '🇱🇮', '🇱🇰', '🇱🇷', '🇱🇸', '🇱🇹', '🇱🇺', '🇱🇻', '🇱🇾', '🇲🇦', '🇲🇨', '🇲🇩', '🇲🇪', '🇲🇫', '🇲🇬', '🇲🇭', '🇲🇰', '🇲🇱', '🇲🇲', '🇲🇳', '🇲🇴', '🇲🇵', '🇲🇶', '🇲🇷', '🇲🇸', '🇲🇹', '🇲🇺', '🇲🇻', '🇲🇼', '🇲🇽', '🇲🇾', '🇲🇿', '🇳🇦', '🇳🇨', '🇳🇪', '🇳🇫', '🇳🇬', '🇳🇮', '🇳🇱', '🇳🇴', '🇳🇵', '🇳🇷', '🇳🇺', '🇳🇿', '🇴🇲', '🇵🇦', '🇵🇪', '🇵🇫', '🇵🇬', '🇵🇭', '🇵🇰', '🇵🇱', '🇵🇲', '🇵🇳', '🇵🇷', '🇵🇸', '🇵🇹', '🇵🇼', '🇵🇾', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇸', '🇷🇺', '🇷🇼', '🇸🇦', '🇸🇧', '🇸🇨', '🇸🇩', '🇸🇪', '🇸🇬', '🇸🇭', '🇸🇮', '🇸🇯', '🇸🇰', '🇸🇱', '🇸🇲', '🇸🇳', '🇸🇴', '🇸🇷', '🇸🇸', '🇸🇹', '🇸🇻', '🇸🇽', '🇸🇾', '🇸🇿', '🇹🇦', '🇹🇨', '🇹🇩', '🇹🇫', '🇹🇬', '🇹🇭', '🇹🇯', '🇹🇰', '🇹🇱', '🇹🇲', '🇹🇳', '🇹🇴', '🇹🇷', '🇹🇹', '🇹🇻', '🇹🇼', '🇹🇿', '🇺🇦', '🇺🇬', '🇺🇲', '🇺🇳', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇦', '🇻🇨', '🇻🇪', '🇻🇬', '🇻🇮', '🇻🇳', '🇻🇺', '🇼🇫', '🇼🇸', '🇽🇰', '🇾🇪', '🇾🇹', '🇿🇦', '🇿🇲', '🇿🇼']
  }
];

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Smileys & People');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('slack_recent_emojis');
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSelectEmoji = (emoji: string) => {
    onSelect(emoji);
    
    // Add to recently used
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 36);
    setRecentEmojis(updated);
    try {
      localStorage.setItem('slack_recent_emojis', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const getFilteredCategories = () => {
    const categories = EMOJI_CATEGORIES.map(cat => {
      if (cat.name === 'Recently Used') {
        return { ...cat, emojis: recentEmojis };
      }
      return cat;
    });

    if (!searchQuery.trim()) {
      return categories.filter(c => c.name !== 'Recently Used' || c.emojis.length > 0);
    }

    const query = searchQuery.toLowerCase();
    return categories
      .map(cat => ({
        ...cat,
        emojis: cat.emojis.filter(e => {
          // Simple emoji search - standard emojis don't have descriptions in simple arrays,
          // but we can query by unicode descriptors or just return matches.
          // For a lightweight search, we search if user types emojis or we could search by basic aliases.
          return true; // Simple categories filter
        })
      }))
      .filter(cat => cat.emojis.length > 0);
  };

  const filteredCategories = getFilteredCategories();

  return (
    <div className="absolute bottom-11 right-0 w-72 h-96 bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden z-50 animate-fadeIn" onClick={e => e.stopPropagation()}>
      {/* Search Header */}
      <div className="p-3 border-b border-border/80 flex items-center gap-2 bg-secondary/10 shrink-0">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground"
          autoFocus
        />
      </div>

      {/* Category Icons navigation */}
      <div className="flex justify-around items-center px-1.5 py-2 border-b border-border/60 bg-secondary/5 shrink-0 text-muted-foreground">
        {filteredCategories.map(cat => {
          const IconComponent = cat.icon;
          const isActive = activeCategory === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => {
                setActiveCategory(cat.name);
                const el = document.getElementById(`emoji-cat-${cat.name}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
              className={`p-1.5 rounded-lg hover:bg-secondary/40 hover:text-foreground transition-all ${
                isActive ? 'text-primary bg-primary/10 font-bold scale-110 shadow-sm' : ''
              }`}
              title={cat.name}
            >
              <IconComponent className="w-3.5 h-3.5" />
            </button>
          );
        })}
      </div>

      {/* Emoji Scroll List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {filteredCategories.map(cat => (
          <div key={cat.name} id={`emoji-cat-${cat.name}`} className="space-y-2">
            <h5 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{cat.name}</h5>
            <div className="grid grid-cols-7 gap-1.5">
              {cat.emojis.map((emoji, idx) => (
                <button
                  key={`${emoji}-${idx}`}
                  type="button"
                  onClick={() => handleSelectEmoji(emoji)}
                  className="text-lg hover:scale-125 transition-transform flex items-center justify-center p-1 cursor-pointer hover:bg-secondary/20 rounded-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
        {filteredCategories.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-10">No emojis found.</p>
        )}
      </div>
    </div>
  );
}
