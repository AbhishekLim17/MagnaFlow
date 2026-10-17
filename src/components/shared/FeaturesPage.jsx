// Features: what the workspace can do (lib/featureCatalog), which parts are on (lib/features).
// Org admins add and remove optional features for everyone; anyone can hide an optional
// feature from their own menu. "Know more" (?feature=<id>) opens a page that explains one
// feature with steps, an example and screenshots.
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, BookOpen, Building2, CalendarClock, CheckSquare, DollarSign, EyeOff, Eye, FileText, Flag,
  GanttChartSquare, Gauge, Globe, HeartPulse, History, Inbox, LayoutDashboard, ListPlus, Mail, Palmtree, Plus,
  Puzzle, ShieldAlert, Target, Users, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useFeatures } from '@/contexts/FeaturesContext';
import { CATEGORIES, FEATURE_CATALOG, catalogEntry } from '@/lib/featureCatalog';
import { isCore } from '@/lib/features';

const ICONS = {
  BarChart3, BookOpen, Building2, CalendarClock, CheckSquare, DollarSign, FileText, Flag, GanttChartSquare, Gauge,
  Globe, HeartPulse, History, Inbox, LayoutDashboard, ListPlus, Mail, Palmtree, ShieldAlert, Target, Users, Zap,
};
const iconOf = (f) => ICONS[f.icon] || Puzzle;
const FILTERS = [['all', 'All'], ['on', 'In use'], ['off', 'Available to add']];

const StatusBadge = ({ id, on }) => (isCore(id)
  ? <Badge variant="secondary">Essential</Badge>
  : on ? <Badge variant="success">On</Badge> : <Badge variant="outline">Off</Badge>);

/** Add / remove (admins) and show / hide in my menu (everyone), for one feature. */
const FeatureActions = ({ feature, size = 'sm' }) => {
  const { isOn, isShown, canManage, setFeature, setHidden } = useFeatures();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const on = isOn(feature.id);
  if (isCore(feature.id)) return null;

  const change = async (next) => {
    if (!next) {
      const ok = await confirm({
        title: `Remove ${feature.name}?`,
        description: 'It disappears from everyone\'s menu and its emails pause. Nothing is deleted: add it back any time and everything is where it was.',
        confirmLabel: 'Remove',
      });
      if (!ok) return;
    }
    setBusy(true);
    try { await setFeature(feature.id, next); } catch { /* the context has said why */ } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManage && (on
        ? <Button type="button" size={size} variant="outline" disabled={busy} onClick={() => change(false)} aria-label={`Remove ${feature.name}`}>Remove</Button>
        : <Button type="button" size={size} disabled={busy} onClick={() => change(true)} aria-label={`Add ${feature.name}`}><Plus className="h-4 w-4" aria-hidden="true" /> Add</Button>)}
      {on && (
        <Button type="button" size={size} variant="ghost" onClick={() => setHidden(feature.id, isShown(feature.id))}
          aria-label={isShown(feature.id) ? `Hide ${feature.name} from my menu` : `Show ${feature.name} in my menu`}>
          {isShown(feature.id) ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {isShown(feature.id) ? 'Hide from my menu' : 'Show in my menu'}
        </Button>
      )}
      {!on && !canManage && <span className="text-xs text-muted-foreground">Ask your admin to add it</span>}
    </div>
  );
};

/** A screenshot or GIF; disappears if the file is missing. */
const Media = ({ item, large }) => {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-muted">
      <img
        src={item.src}
        alt={item.caption}
        loading="lazy"
        onError={() => setMissing(true)}
        className={`w-full object-cover object-top ${large ? 'max-h-[460px]' : 'max-h-[260px]'}`}
      />
      <figcaption className="flex items-center gap-2 border-t border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        {item.kind === 'gif' && <Badge variant="secondary">Animation</Badge>}
        {item.caption}
      </figcaption>
    </figure>
  );
};

const FeatureDetail = ({ feature, onBack }) => {
  const { isOn } = useFeatures();
  const Icon = iconOf(feature);
  const [first, ...rest] = feature.media || [];
  const category = CATEGORIES.find((c) => c.id === feature.category);
  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All features</Button>
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-7 w-7" aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category?.name}</p>
              <CardTitle className="mt-1 text-2xl">{feature.name}</CardTitle>
              <p className="mt-1 text-muted-foreground">{feature.summary}</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <StatusBadge id={feature.id} on={isOn(feature.id)} />
            <FeatureActions feature={feature} size="default" />
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {first && <Media item={first} large />}

          <section aria-labelledby="fd-what">
            <h3 id="fd-what" className="mb-2 text-lg font-semibold">What it does</h3>
            <p className="leading-relaxed text-foreground">{feature.what}</p>
          </section>

          <section aria-labelledby="fd-how">
            <h3 id="fd-how" className="mb-2 text-lg font-semibold">How to use it</h3>
            <ol className="space-y-2">
              {feature.steps.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="fd-example" className="rounded-xl border-l-4 border-primary bg-primary-soft/50 p-4">
            <h3 id="fd-example" className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">Example</h3>
            <p className="leading-relaxed text-foreground">{feature.example}</p>
          </section>

          {rest.length > 0 && (
            <section aria-labelledby="fd-more" className="space-y-3">
              <h3 id="fd-more" className="text-lg font-semibold">More screens</h3>
              <div className="grid gap-4 md:grid-cols-2">{rest.map((m) => <Media key={m.src} item={m} />)}</div>
            </section>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {feature.tips?.length > 0 && (
              <section aria-labelledby="fd-tips">
                <h3 id="fd-tips" className="mb-2 text-lg font-semibold">Good to know</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">{feature.tips.map((t) => <li key={t}>{t}</li>)}</ul>
              </section>
            )}
            <section aria-labelledby="fd-who">
              <h3 id="fd-who" className="mb-2 text-lg font-semibold">Who uses it</h3>
              <p className="text-sm leading-relaxed">{feature.roles}</p>
              {feature.emails && <p className="mt-2 text-sm leading-relaxed"><span className="font-semibold">Emails: </span>{feature.emails}</p>}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FeaturesPage = () => {
  const { isOn, canManage, ready } = useFeatures();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const open = catalogEntry(params.get('feature'));

  const go = (id) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (id) next.set('feature', id); else next.delete('feature');
    return next;
  });

  if (open) return <FeatureDetail feature={open} onBack={() => go(null)} />;

  const shown = FEATURE_CATALOG.filter((f) => (filter === 'all' ? true : filter === 'on' ? isOn(f.id) : !isOn(f.id)));
  const added = FEATURE_CATALOG.filter((f) => !isCore(f.id) && isOn(f.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-muted-foreground">
          {canManage
            ? 'Add the features your team needs. Essentials are always on. Removing a feature hides it from everyone and pauses its emails; its data stays.'
            : 'The features your organisation uses. Hide the ones you don\'t need from your own menu.'}
          {ready && <span className="block text-sm"> {added} added, {FEATURE_CATALOG.length - added - FEATURE_CATALOG.filter((f) => isCore(f.id)).length} more available.</span>}
        </p>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1" role="group" aria-label="Show">
          {FILTERS.map(([value, label]) => (
            <Button key={value} type="button" size="sm" variant={filter === value ? 'default' : 'ghost'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>
          ))}
        </div>
      </div>

      {CATEGORIES.map((cat) => {
        const items = shown.filter((f) => f.category === cat.id);
        if (!items.length) return null;
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`} className="space-y-3">
            <div>
              <h2 id={`cat-${cat.id}`} className="text-lg font-semibold">{cat.name}</h2>
              <p className="text-sm text-muted-foreground">{cat.blurb}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((f) => {
                const Icon = iconOf(f);
                const on = isOn(f.id);
                return (
                  <li key={f.id}>
                    <Card className={`flex h-full flex-col p-5 ${on ? '' : 'border-dashed'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${on ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground'}`}>
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <StatusBadge id={f.id} on={on} />
                      </div>
                      <h3 className="mt-3 font-semibold">{f.name}</h3>
                      <p className="mt-1 flex-1 text-sm text-muted-foreground">{f.summary}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <FeatureActions feature={f} />
                        <Button type="button" size="sm" variant="link" className="px-0" onClick={() => go(f.id)} aria-label={`Know more about ${f.name}`}>Know more →</Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

export default FeaturesPage;
