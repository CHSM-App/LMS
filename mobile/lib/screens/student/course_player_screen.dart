import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
import '../../presentation/viewModels/download_viewmodel.dart';
import '../../widgets/app_widgets.dart';
import 'downloads_screen.dart' show downloadMessageText;
import 'widgets/common.dart';
import 'widgets/lesson_row.dart';
import 'widgets/video_view.dart';

/// Course player: progress, the open lesson (video / notes / link) and the lesson list with downloads.
class CoursePlayerScreen extends ConsumerStatefulWidget {
  const CoursePlayerScreen({super.key, required this.courseId});
  final int courseId;

  @override
  ConsumerState<CoursePlayerScreen> createState() => _CoursePlayerScreenState();
}

class _CoursePlayerScreenState extends ConsumerState<CoursePlayerScreen> {
  int? _current;

  void _refresh() {
    ref.invalidate(courseViewProvider(widget.courseId));
    ref.invalidate(lessonProvider);
    ref.invalidate(studentDashboardProvider);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final async = ref.watch(courseViewProvider(widget.courseId));
    return Scaffold(
      appBar: AppBar(title: Text(async.valueOrNull?.title ?? '', overflow: TextOverflow.ellipsis)),
      body: AsyncView<CourseView>(
        value: async,
        onRetry: () => ref.invalidate(courseViewProvider(widget.courseId)),
        builder: (c) {
          final lessons = c.lessons;
          _current ??= (lessons.where((x) => !x.completed && !x.locked).firstOrNull ?? lessons.where((x) => !x.locked).firstOrNull)?.id;
          final anyDownloadable = lessons.any((x) => x.downloadable);
          final downloads = anyDownloadable ? ref.watch(downloadsProvider) : null;
          return ListView(
            padding: const EdgeInsets.all(AppTokens.spaceS4),
            children: [
              LabeledProgress(value: c.progressPct / 100, semanticLabel: c.title),
              if (c.readOnly) Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS3), child: AppBanner(kind: 'warning', message: l.sReadOnly)),
              if (downloads?.message != null)
                Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS3), child: AppBanner(kind: 'warning', message: downloadMessageText(l, downloads!.message!))),
              const SizedBox(height: AppTokens.spaceS3),
              if (_current == null) EmptyState(title: l.sNoLessons) else _LessonPanel(key: ValueKey(_current), contentId: _current!, downloaded: downloads?.items[_current]?.status == DownloadStatus.completed, onCompleted: _refresh),
              SectionTitle(l.sLessons),
              for (final s in c.subjects) ...[
                Text(s.name, style: const TextStyle(fontWeight: FontWeight.w800, color: AppTokens.heading)),
                for (final m in s.modules) ...[
                  Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS2), child: Text(m.name, style: const TextStyle(color: AppTokens.textSecondary, fontWeight: FontWeight.w600))),
                  for (final x in m.lessons)
                    LessonRow(
                      lesson: x,
                      selected: x.id == _current,
                      download: downloads?.items[x.id],
                      onTap: () => setState(() => _current = x.id),
                      onDownload: () => ref.read(downloadsProvider.notifier).download(contentId: x.id, courseId: c.courseId, courseTitle: c.title, title: x.title),
                      onPause: () => ref.read(downloadsProvider.notifier).pause(x.id),
                      onResume: () => ref.read(downloadsProvider.notifier).resume(x.id),
                    ),
                ],
              ],
            ],
          );
        },
      ),
    );
  }
}

class _LessonPanel extends ConsumerStatefulWidget {
  const _LessonPanel({super.key, required this.contentId, required this.downloaded, required this.onCompleted});
  final int contentId;
  final bool downloaded;
  final VoidCallback onCompleted;

  @override
  ConsumerState<_LessonPanel> createState() => _LessonPanelState();
}

class _LessonPanelState extends ConsumerState<_LessonPanel> {
  bool _busy = false;
  String? _error;

  Future<void> _complete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(studentRepositoryProvider).saveProgress(widget.contentId, completed: true);
      widget.onCompleted();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final repo = ref.read(studentRepositoryProvider);
    return AsyncView<LessonDetail>(
      value: ref.watch(lessonProvider(widget.contentId)),
      onRetry: () => ref.invalidate(lessonProvider(widget.contentId)),
      builder: (x) => Card(
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spaceS4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(x.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: AppTokens.spaceS3),
              if (x.type == 'live' && x.live != null) _LivePanel(live: x.live!),
              if ((x.type == 'video' || x.live?.stage == 'recorded') && x.videoSource == 'upload' && x.url != null)
                VideoView(
                  url: Uri.parse(x.url!),
                  startAt: x.lastPositionSec,
                  onPosition: (sec) => repo.saveProgress(x.id, positionSec: sec).catchError((_) {}),
                  onEnded: x.completed ? null : _complete,
                ),
              if ((x.type == 'video' || x.live?.stage == 'recorded') && x.videoSource != 'upload' && x.url != null)
                AppButton(label: l.sWatchOnSite, variant: AppButtonVariant.secondary, icon: Icons.open_in_new, onPressed: () => openExternal(x.url!)),
              if (widget.downloaded)
                Padding(
                  padding: const EdgeInsets.only(top: AppTokens.spaceS2),
                  child: AppButton(label: l.sWatchOffline, variant: AppButtonVariant.secondary, icon: Icons.offline_pin_outlined, onPressed: () => context.push('/student/offline/${x.id}')),
                ),
              if (x.type == 'pdf' && x.url != null) AppButton(label: l.sOpenNotes, variant: AppButtonVariant.secondary, icon: Icons.description_outlined, onPressed: () => openInApp(x.url!)),
              if (x.type == 'link' && x.url != null) AppButton(label: l.sOpenLink, variant: AppButtonVariant.secondary, icon: Icons.open_in_new, onPressed: () => openExternal(x.url!)),
              const SizedBox(height: AppTokens.spaceS3),
              if (_error != null) Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS2), child: AppBanner(kind: 'error', message: _error!)),
              if (x.completed)
                Align(alignment: Alignment.centerLeft, child: StatusBadge(status: 'completed', label: l.sCompleted))
              else if (x.canComplete)
                AppButton(label: l.sMarkComplete, variant: AppButtonVariant.compact, loading: _busy, onPressed: _complete),
            ],
          ),
        ),
      ),
    );
  }
}

/// Live lesson: start time and stage; Join while live (opens Meet outside the app);
/// "Recording coming soon" after it ends. A recording plays like any video (handled by the caller).
class _LivePanel extends ConsumerWidget {
  const _LivePanel({required this.live});
  final LessonLive live;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTokens.spaceS3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: AppTokens.spaceS2, crossAxisAlignment: WrapCrossAlignment.center, children: [
            LiveStageChip(stage: live.stage),
            if (live.startsAt != null) Text(l.sLiveStartsAt(formatDateTime(context, live.startsAt!)), style: const TextStyle(color: AppTokens.textSecondary)),
          ]),
          const SizedBox(height: AppTokens.spaceS2),
          if (live.stage == 'unscheduled') Text(l.sLiveScheduleSoon),
          if (live.stage == 'upcoming') Text(l.sLiveJoinOpens, style: const TextStyle(color: AppTokens.textSecondary)),
          if (live.stage == 'live' && live.meetLink != null)
            AppButton(label: l.sLiveJoin, icon: Icons.videocam_outlined, onPressed: () => joinLiveClass(ref, live.liveClassId, live.meetLink!)),
          if (live.stage == 'live' && live.meetLink == null) Text(l.sLiveWaitingForLink, style: const TextStyle(color: AppTokens.textSecondary)),
          if (live.stage == 'ended') Text(l.sLiveRecordingSoon),
          if (live.stage == 'cancelled') Text(l.sLiveCancelledText),
        ],
      ),
    );
  }
}
