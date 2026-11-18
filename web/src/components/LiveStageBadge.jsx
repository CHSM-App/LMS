import { useTranslation } from 'react-i18next';

// Stage of a live lesson: upcoming, live, ended, recorded, cancelled. Colours come from badge tokens.
const STAGE_CLASS = { upcoming: 'info', live: 'pending', recorded: 'approved', ended: 'neutral', cancelled: 'neutral' };

export function LiveStageBadge({ stage }) {
  const { t } = useTranslation();
  return <span className={`badge badge--${STAGE_CLASS[stage] || 'neutral'}`}>{t(`content.live.stage.${stage}`)}</span>;
}
