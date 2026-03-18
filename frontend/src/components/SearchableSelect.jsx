import React, { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

// options: [{ id, label, sublabel? }]
// value: selected id (number or string or '')
// onChange: (id) => void
export function SearchableSelect({
  options,
  value,
  onChange,
  searchPlaceholder = 'Suchen...',
  emptyLabel = '– Keine Auswahl –',
  className = '',
}) {
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOffen(false);
        setSuche('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // eslint-disable-next-line eqeqeq
  const selected = options.find(o => o.id == value);
  const gefiltert = suche
    ? options.filter(o =>
        o.label.toLowerCase().includes(suche.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(suche.toLowerCase()))
      )
    : options;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        className="input w-full flex items-center justify-between gap-2 text-left"
        onClick={() => setOffen(v => !v)}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400 italic'}>
          {selected ? selected.label : emptyLabel}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${offen ? 'rotate-180' : ''}`} />
      </button>

      {offen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden" style={{ minWidth: '220px' }}>
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="search"
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400"
                placeholder={searchPlaceholder}
                value={suche}
                onChange={e => setSuche(e.target.value)}
                autoFocus
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                data-1p-ignore="true"
                readOnly
                onFocus={e => { e.target.readOnly = false; }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <div
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${!value ? 'bg-gray-50 font-medium text-gray-700' : 'text-gray-400 italic'}`}
              onClick={() => { onChange(''); setOffen(false); setSuche(''); }}
            >
              {emptyLabel}
            </div>
            {gefiltert.map(o => (
              <div
                key={o.id}
                // eslint-disable-next-line eqeqeq
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-yellow-50 ${value == o.id ? 'bg-yellow-50 font-semibold' : ''}`}
                onClick={() => { onChange(o.id); setOffen(false); setSuche(''); }}
              >
                <div className="text-gray-900">{o.label}</div>
                {o.sublabel && <div className="text-xs text-gray-400 mt-0.5">{o.sublabel}</div>}
              </div>
            ))}
            {gefiltert.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-400 text-center">Keine Ergebnisse</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
