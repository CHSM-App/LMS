import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';

// Clicking Join marks attendance automatically; Meet still opens even if that call fails.
function markJoined(liveClassId) {
  if (!liveClassId) return;
  api.post(`/student/live-classes/${liveClassId}/join`, {}).catch(() => {});
}
import { LiveStageBadge, VideoFrame } from '../../components';
import { formatDateTime } from '../../utils/format';

// A live lesson in the player: Upcoming → Live now (Join) → Ended ("Recording coming soon") → Recorded (plays).
export function LiveLessonPanel({ content: c, onTimeUpdate, onEnded }) {
  const { t, i18n } = useTranslation();
  const { stage, startsAt, meetLink } = c.live;
  // My batch has no date for this lesson yet.
  if (stage === 'unscheduled') {
    return (
      <div className="stack">
        <p className="row"><LiveStageBadge stage={stage} /></p>
        <p>{t('content.live.scheduleSoon')}</p>
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="row">
        <LiveStageBadge stage={stage} />
        <span className="muted">{t('content.live.startsOn', { when: formatDateTime(startsAt, i18n.language) })}</span>
      </p>
      {stage === 'upcoming' && <p className="field__hint">{t('content.live.joinOpens')}</p>}
      {stage === 'live' && meetLink && (
        <p>
          <a className="btn btn--primary" href={meetLink} target="_blank" rel="noopener noreferrer" onClick={() => markJoined(c.live.liveClassId)}>
            <span className="btn__label">{t('content.live.join')}</span>
          </a>
        </p>
      )}
      {stage === 'live' && !meetLink && <p className="field__hint">{t('content.live.waitingForLink')}</p>}
      {stage === 'ended' && <p>{t('content.live.recordingSoon')}</p>}
      {stage === 'cancelled' && <p>{t('content.live.cancelledText')}</p>}
      {stage === 'recorded' && (
        <VideoFrame source={c.videoSource} url={c.videoSource === 'upload' ? fileUrl(c.url) : c.url} title={c.title} startAt={c.lastPositionSec || 0}
          onTimeUpdate={c.videoSource === 'upload' ? onTimeUpdate : undefined} onEnded={onEnded} />
      )}
    </div>
  );
}
