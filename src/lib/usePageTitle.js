// One title per screen. Every tab used to read "MagnaFlow - Role-Based Project & Task
// Management", so several open tabs, the history list and a screen reader's page
// announcement were all indistinguishable.
import { useEffect } from 'react';

export const APP_NAME = 'MagnaFlow';

export const formatTitle = (title) => (title ? `${title} · ${APP_NAME}` : APP_NAME);

export const usePageTitle = (title) => {
  useEffect(() => {
    document.title = formatTitle(title);
  }, [title]);
};
