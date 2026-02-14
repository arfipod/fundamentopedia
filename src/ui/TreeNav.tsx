import { useMemo, useState } from 'react';
import type { GicsLevel, GicsTreeNode } from '../types';
import { useI18n } from '../i18n/i18n';

interface Props {
  tree: GicsTreeNode[];
  selectedCode: string | null;
  granularity: GicsLevel;
  onSelect: (code: string) => void;
}

export function TreeNav({ tree, selectedCode, granularity, onSelect }: Props) {
  const [openCodes, setOpenCodes] = useState<Record<string, boolean>>({});
  const { t } = useI18n();

  const toggle = (code: string) => setOpenCodes((prev: Record<string, boolean>) => ({ ...prev, [code]: !prev[code] }));

  const isSelectable = useMemo(() => (level: GicsLevel) => level === granularity, [granularity]);

  const renderNode = (node: GicsTreeNode, depth = 0) => {
    const hasChildren = Boolean(node.children?.length);
    const isOpen = openCodes[node.code] ?? depth < 1;
    const selectable = isSelectable(node.level);
    const isActive = selectedCode === node.code;

    return (
      <div key={node.code}>
        <div className="d-flex align-items-center gap-1 py-1" style={{ paddingLeft: depth * 12 }}>
          {hasChildren ? (
            <button type="button" className="btn btn-sm btn-link text-decoration-none p-0" onClick={() => toggle(node.code)}>
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="text-muted small">•</span>
          )}
          <button
            type="button"
            disabled={!selectable}
            className={`btn btn-sm text-start flex-grow-1 ${isActive ? 'btn-primary' : selectable ? 'btn-outline-light border-0' : 'btn-light border-0 text-muted'}`}
            onClick={() => onSelect(node.code)}
          >
            <span className="badge text-bg-light me-1">{node.code}</span>
            {t(`gics.name.${node.code}`, node.name_es)}
          </button>
        </div>
        {hasChildren && isOpen && <div>{node.children?.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    );
  };

  return <div>{tree.map((node) => renderNode(node))}</div>;
}
