import { useState, useRef } from 'react';

export default function PanelSection({ title, children }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hoverRef = useRef(false);

  const isOpen = pinned || open;

  return (
    <div className="section-wrap"
      onMouseEnter={() => { hoverRef.current = true; setOpen(true); }}
      onMouseLeave={() => { hoverRef.current = false; if (!pinned) setOpen(false); }}
    >
      <div className="section-title">
        <span>{title}</span>
        <button
          className="section-pin"
          title={pinned ? 'Losmaken' : 'Vastzetten'}
          onClick={e => { e.stopPropagation(); setPinned(p => !p); }}
        >
          {pinned ? '−' : '+'}
        </button>
      </div>
      <div className={`section-content ${isOpen ? 'open' : ''}`}>
        {children}
      </div>
    </div>
  );
}
