import 'package:flutter/material.dart';

import '../../../core/theme/app_tokens.g.dart';
import '../../../data/models/student_models.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/viewModels/download_viewmodel.dart';

/// One lesson in the course list. The download control appears only for uploaded videos
/// (YouTube/Vimeo/Bunny links can only be watched online). There is no share action.
class LessonRow extends StatelessWidget {
  const LessonRow({super.key, required this.lesson, required this.onTap, this.download, this.onDownload, this.onPause, this.onResume, this.selected = false});
  final Lesson lesson;
  final DownloadItem? download;
  final VoidCallback onTap;
  final VoidCallback? onDownload;
  final VoidCallback? onPause;
  final VoidCallback? onResume;
  final bool selected;

  bool get _canDownload => lesson.type == 'video' && lesson.videoSource == 'upload';

  IconData get _icon => switch (lesson.type) {
        'video' => Icons.play_circle_outline,
        'pdf' => Icons.description_outlined,
        _ => Icons.link,
      };

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return ListTile(
      selected: selected,
      selectedTileColor: AppTokens.selectedBg,
      enabled: !lesson.locked,
      leading: Icon(lesson.completed ? Icons.check_circle : (lesson.locked ? Icons.lock_outline : _icon), color: lesson.completed ? AppTokens.successText : AppTokens.textSecondary),
      title: Text(lesson.title, maxLines: 2, overflow: TextOverflow.ellipsis),
      subtitle: lesson.locked ? Text(l.sLocked) : (download == null ? null : DownloadChip(item: download!)),
      trailing: _canDownload && !lesson.locked ? _trailing(l) : null,
      onTap: lesson.locked ? null : onTap,
    );
  }

  Widget? _trailing(AppLocalizations l) {
    final d = download;
    if (d == null || d.status == DownloadStatus.failed) {
      return IconButton(tooltip: l.sDownload, icon: const Icon(Icons.download_outlined), onPressed: onDownload);
    }
    return switch (d.status) {
      DownloadStatus.completed => Tooltip(message: l.sDownloaded, child: const Icon(Icons.download_done, color: AppTokens.successText)),
      DownloadStatus.downloading => IconButton(tooltip: l.sPause, icon: const Icon(Icons.pause_circle_outline), onPressed: onPause),
      _ => IconButton(tooltip: l.sResume, icon: const Icon(Icons.play_arrow), onPressed: onResume),
    };
  }
}

class DownloadChip extends StatelessWidget {
  const DownloadChip({super.key, required this.item});
  final DownloadItem item;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = switch (item.status) {
      DownloadStatus.completed => '✓ ${l.sDownloaded}',
      DownloadStatus.downloading => l.sDownloading('${item.percent}'),
      DownloadStatus.paused => l.sPaused,
      DownloadStatus.waitingWifi => l.sWaitingWifi,
      DownloadStatus.queued => l.sQueued,
      DownloadStatus.failed => l.sDownloadFailed,
    };
    return Text(text, style: const TextStyle(fontSize: AppTokens.textSm, color: AppTokens.textSecondary));
  }
}
