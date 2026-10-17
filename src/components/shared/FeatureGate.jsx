// Shows a page only when its feature is on (lib/features); otherwise says so, and offers an
// org admin the way to add it. Used on the routes of optional features.
import React from 'react';
import { Link } from 'react-router-dom';
import { Puzzle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { useFeatures } from '@/contexts/FeaturesContext';
import { catalogEntry } from '@/lib/featureCatalog';

const FeatureGate = ({ feature, children, hint }) => {
  const { ready, isOn, canManage } = useFeatures();
  if (!ready) return <LoadingState label="Loading…" />;
  if (isOn(feature)) return children;
  const name = catalogEntry(feature)?.name || 'This feature';
  return (
    <EmptyState
      icon={Puzzle}
      title={`${name} is not switched on`}
      hint={hint || (canManage ? 'Add it from Features: nothing is lost, its data comes back as it was.' : 'Ask your organisation admin to add it.')}
      action={canManage ? <Button asChild><Link to={`/admin/features?feature=${feature}`}>See {name}</Link></Button> : null}
    />
  );
};

export default FeatureGate;
