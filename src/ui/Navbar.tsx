import { useEffect, useState } from 'react';
import type { GicsLevel } from '../types';
import { useI18n } from '../i18n/i18n';

interface Props {
  granularity: GicsLevel;
  onGranularityChange: (level: GicsLevel) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
}

export function Navbar({ granularity, onGranularityChange, searchText, onSearchTextChange }: Props) {
  const { lang, setLang, t } = useI18n();
  const [isPortrait, setIsPortrait] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)');
    const updateOrientation = () => {
      const portrait = media.matches;
      setIsPortrait(portrait);
      setIsCollapsed(portrait);
    };

    updateOrientation();
    media.addEventListener('change', updateOrientation);
    return () => media.removeEventListener('change', updateOrientation);
  }, []);

  const controlsClass = isPortrait && isCollapsed ? 'd-none' : 'd-flex';

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary border-bottom sticky-top">
      <div className="container-fluid gap-2">
        <span className="navbar-brand mb-0 h1">{t('ui.app.title', 'GICS Encyclopedia')}</span>
        {isPortrait ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary ms-auto"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? t('ui.nav.expand_filters', 'Show selectors') : t('ui.nav.collapse_filters', 'Hide selectors')}
          </button>
        ) : null}
        <div className={`${controlsClass} flex-wrap gap-2 align-items-center ms-lg-auto w-100`} style={{ maxWidth: 680 }}>
          <select
            className="form-select form-select-sm"
            value={lang}
            onChange={(e) => void setLang(e.target.value as 'en' | 'es')}
            style={{ width: 96 }}
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
          <select
            className="form-select form-select-sm"
            value={granularity}
            onChange={(e) => onGranularityChange(e.target.value as GicsLevel)}
            style={{ flex: '1 1 180px', minWidth: 160 }}
          >
            <option value="sector">{t('ui.granularity.sector', 'Sector')}</option>
            <option value="industry_group">{t('ui.granularity.industry_group', 'Industry Group')}</option>
            <option value="industry">{t('ui.granularity.industry', 'Industry')}</option>
            <option value="sub_industry">{t('ui.granularity.sub_industry', 'Sub-Industry')}</option>
          </select>
          <input
            className="form-control form-control-sm"
            style={{ flex: '1 1 260px', minWidth: 160 }}
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            placeholder={t('ui.search.placeholder', 'Search by code or name')}
          />
        </div>
      </div>
    </nav>
  );
}
