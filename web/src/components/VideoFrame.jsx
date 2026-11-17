// One player frame for uploaded and linked videos. Uploaded videos stream only:
// no download control and no context menu (DECISIONS: offline download is app-only).
export function embedUrl(source, url) {
  try {
    const u = new URL(url);
    if (source === 'youtube') {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.split('/').pop();
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
    }
    if (source === 'vimeo') return `https://player.vimeo.com/video/${encodeURIComponent(u.pathname.split('/').filter(Boolean).pop())}`;
    if (source === 'bunny') return url;
  } catch {
    return null;
  }
  return null;
}

export function VideoFrame({ source, url, title, onTimeUpdate, onEnded, startAt = 0 }) {
  if (!url) return <div className="video-frame video-frame--empty" aria-label={title} />;
  if (source === 'upload') {
    return (
      <div className="video-frame">
        <video
          src={url}
          title={title}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          preload="metadata"
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={(e) => { if (startAt) e.currentTarget.currentTime = startAt; }}
          onTimeUpdate={onTimeUpdate ? (e) => onTimeUpdate(e.currentTarget.currentTime) : undefined}
          onEnded={onEnded}
        />
      </div>
    );
  }
  const src = embedUrl(source, url);
  return (
    <div className="video-frame">
      {src ? (
        <iframe src={src} title={title} allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      ) : null}
    </div>
  );
}
