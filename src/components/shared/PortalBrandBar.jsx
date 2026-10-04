// The client portal's top bar in the organisation's colours: their logo and name on their
// accent colour, with text in whichever of white/near-black reads better on it. Used by the
// portal itself and by the admin's preview, so the preview is exactly what clients see.
import React from 'react';
import { FolderOpen } from 'lucide-react';
import { textOn } from '@/lib/branding';

const PortalBrandBar = ({ branding, orgName, subtitle = 'Client portal', children, as: Tag = 'div', className = '' }) => {
  const accent = branding?.accent || null;
  const fg = accent ? textOn(accent) : undefined;
  return (
    <Tag
      className={`border-b ${accent ? 'border-transparent' : 'border-border bg-card'} ${className}`}
      style={accent ? { backgroundColor: accent, color: fg } : undefined}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {branding?.logo ? (
            <img
              src={branding.logo}
              alt={orgName ? `${orgName} logo` : 'Logo'}
              className="h-9 w-auto max-w-[8rem] shrink-0 rounded-md bg-white/90 object-contain p-0.5"
            />
          ) : (
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accent ? 'bg-black/15' : 'bg-primary text-primary-foreground'}`}>
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{orgName || 'MagnaFlow'}</p>
            <p className={`truncate text-xs ${accent ? 'opacity-90' : 'text-muted-foreground'}`}>{subtitle}</p>
          </div>
        </div>
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      </div>
    </Tag>
  );
};

export default PortalBrandBar;
