import { useMemo } from 'react';
import { useI18n } from '../i18n/i18n';
import type { SearchItem } from '../data/indexer';

interface Props {
  query: string;
  items: SearchItem[];
  onSelect: (code: string) => void;
}

export function SearchBox({ query, items, onSelect }: Props) {
  const { t } = useI18n();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((item) => item.code.toLowerCase().startsWith(q) || t(`gics.name.${item.code}`, item.fallbackName).toLowerCase().includes(q))
      .slice(0, 12);
  }, [items, query, t]);

  if (!query.trim() || matches.length === 0) {
    return null;
  }

  return (
    <div className="position-absolute bg-white border rounded shadow-sm w-100" style={{ zIndex: 20 }}>
      <div className="list-group list-group-flush">
        {matches.map((item) => (
          <button
            type="button"
            className="list-group-item list-group-item-action"
            key={item.code}
            onClick={() => onSelect(item.code)}
          >
            <span className="badge text-bg-light me-2">{item.code}</span>
            {t(`gics.name.${item.code}`, item.fallbackName)}
          </button>
        ))}
      </div>
    </div>
  );
}
