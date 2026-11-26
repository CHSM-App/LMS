import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import '../../widgets/course_card.dart';
import '../student/widgets/common.dart';
import '../student/widgets/video_view.dart';

class CourseDetailsScreen extends ConsumerWidget {
  const CourseDetailsScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    final detail = ref.watch(courseDetailProvider(slug));
    final course = detail.valueOrNull;
    final mine = ref.watch(myEnrollmentsProvider)[slug];
    return Scaffold(
      // The cover runs under the status bar; the back button floats on it.
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        shape: const Border(),
        leading: Padding(
          padding: const EdgeInsets.all(6),
          child: IconButton.filled(
            tooltip: MaterialLocalizations.of(context).backButtonTooltip,
            style: IconButton.styleFrom(backgroundColor: AppTokens.surface, foregroundColor: AppTokens.text),
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => context.canPop() ? context.pop() : context.go('/courses'),
          ),
        ),
      ),
      // The bottom bar follows where I stand with this course, like the website: Enroll, or Go to course,
      // or a "request sent" note. Never a second Enroll for a course I already joined.
      bottomNavigationBar: course == null
          ? null
          : Container(
              decoration: const BoxDecoration(color: AppTokens.surface, border: Border(top: BorderSide(color: AppTokens.divider))),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS4, vertical: AppTokens.spaceS3),
                  child: _ActionBar(
                    course: course,
                    mine: mine,
                    onEnroll: () => _enroll(context, user?.role),
                    onGoToCourse: () => context.go('/student/courses/${mine!.courseId}'),
                  ),
                ),
              ),
            ),
      body: AsyncView<CourseDetail>(
        value: detail,
        onRetry: () => ref.invalidate(courseDetailProvider(slug)),
        builder: (c) => _Body(course: c, slug: slug, enrolled: mine?.status == 'enrolled'),
      ),
    );
  }

  void _enroll(BuildContext context, String? role) {
    if (role == null) {
      context.push('/register?slug=${Uri.encodeQueryComponent(slug)}');
    } else if (role == 'student') {
      context.push('/enroll/$slug');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocalizations.of(context).pLoginToEnroll)));
    }
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.course, required this.slug, this.enrolled = false});

  final CourseDetail course;
  final String slug;

  /// Already enrolled: the demo request makes no sense, so it is hidden (as on the website).
  final bool enrolled;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final c = course;
    final text = Theme.of(context).textTheme;
    final modules = c.curriculum.fold<int>(0, (sum, s) => sum + s.modules.length);
    final stats = [
      if (c.durationText != null && c.durationText!.isNotEmpty) (Icons.schedule_rounded, c.durationText!, l.pStatDuration),
      if (c.curriculum.isNotEmpty) (Icons.menu_book_rounded, '${c.curriculum.length}', l.pStatSubjects),
      if (modules > 0) (Icons.view_module_rounded, '$modules', l.pStatModules),
      if (c.batches.isNotEmpty) (Icons.groups_rounded, '${c.batches.length}', l.pStatBatches),
    ];
    final includes = [
      if (c.curriculum.isNotEmpty) l.pIncSubjects(c.curriculum.length, modules),
      if (c.demoVideos.isNotEmpty) l.pIncDemo,
      if (c.batches.isNotEmpty) l.pIncBatches(c.batches.length),
      l.pIncDoubts,
    ];
    return ListView(
      padding: const EdgeInsets.only(bottom: AppTokens.spaceS6),
      children: [
        _Hero(course: c),
        Padding(
          padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, AppTokens.spaceS4, AppTokens.spaceS4, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(header: true, child: Text(c.title, style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800))),
              const SizedBox(height: AppTokens.spaceS3),
              Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: AppTokens.brandIce,
                    child: Text(c.teacherName.trim().isEmpty ? '?' : c.teacherName.trim().characters.first.toUpperCase(), style: const TextStyle(color: AppTokens.text, fontSize: AppTokens.textSm, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(width: AppTokens.spaceS2),
                  Expanded(child: Text(l.pBy(c.teacherName), style: const TextStyle(color: AppTokens.text, fontWeight: FontWeight.w700))),
                ],
              ),
              if (stats.isNotEmpty) ...[
                const SizedBox(height: AppTokens.spaceS4),
                // Two per row, so a value like "4 months" is never cut short.
                LayoutBuilder(
                  builder: (context, box) {
                    final w = (box.maxWidth - AppTokens.spaceS2) / 2;
                    return Wrap(
                      spacing: AppTokens.spaceS2,
                      runSpacing: AppTokens.spaceS2,
                      children: [for (final s in stats) SizedBox(width: w, child: _StatTile(icon: s.$1, value: s.$2, label: s.$3))],
                    );
                  },
                ),
              ],
              const SizedBox(height: AppTokens.spaceS4),
              if (!enrolled) AppButton(label: l.pRequestDemo, variant: AppButtonVariant.secondary, icon: Icons.videocam_outlined, expand: true, onPressed: () => context.push('/courses/$slug/demo')),

              SectionTitle(l.pIncludes),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spaceS3),
                  child: Column(
                    children: [
                      for (final item in includes)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 22,
                                height: 22,
                                decoration: const BoxDecoration(color: AppTokens.brandLime, shape: BoxShape.circle),
                                child: const Icon(Icons.check_rounded, size: 15, color: AppTokens.brandNavy),
                              ),
                              const SizedBox(width: AppTokens.spaceS3),
                              Expanded(child: Text(item, style: const TextStyle(color: AppTokens.text, fontSize: AppTokens.textSm + 1, fontWeight: FontWeight.w600, height: 1.35))),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              if (c.description != null && c.description!.isNotEmpty) ...[
                SectionTitle(l.pAbout),
                _ExpandableText(text: c.description!),
              ],
              if (c.demoVideos.isNotEmpty) ...[
                SectionTitle(l.pDemoVideos),
                for (final v in c.demoVideos)
                  v.isUpload
                      ? Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS3), child: _DemoUpload(url: v.url))
                      : Card(child: ListTile(leading: const Icon(Icons.play_circle_outline), title: Text(l.pOpenVideo), onTap: () => openExternal(v.url))),
              ],
              if (c.batches.isNotEmpty) ...[
                SectionTitle(l.pBatches),
                Wrap(spacing: AppTokens.spaceS2, runSpacing: AppTokens.spaceS2, children: [for (final b in c.batches) _InfoChip(icon: Icons.groups_outlined, label: b)]),
              ],
              if (c.curriculum.isNotEmpty) ...[
                SectionTitle(l.pCurriculum),
                Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < c.curriculum.length; i++) ...[
                        if (i > 0) const Divider(height: 1),
                        Theme(
                          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                          child: ExpansionTile(
                            // The first subject starts open, so the list never looks empty.
                            initiallyExpanded: i == 0,
                            shape: const Border(),
                            collapsedShape: const Border(),
                            leading: CircleAvatar(
                              radius: 14,
                              backgroundColor: AppTokens.brandIce,
                              child: Text('${i + 1}', style: const TextStyle(color: AppTokens.text, fontSize: AppTokens.textXs, fontWeight: FontWeight.w800)),
                            ),
                            title: Text(c.curriculum[i].name, style: const TextStyle(fontWeight: FontWeight.w800)),
                            subtitle: Text('${c.curriculum[i].modules.length} ${l.pStatModules}', style: const TextStyle(fontSize: AppTokens.textXs, color: AppTokens.textSecondary)),
                            children: [
                              for (final m in c.curriculum[i].modules)
                                ListTile(dense: true, leading: const Icon(Icons.play_circle_outline, size: 20), title: Text(m, style: const TextStyle(fontWeight: FontWeight.w500))),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Cover with a play button when the course has a free demo: the quickest way to see what it is like.
class _Hero extends StatelessWidget {
  const _Hero({required this.course});

  final CourseDetail course;

  Future<void> _play(BuildContext context, VideoRef v) async {
    if (!v.isUpload) return openExternal(v.url);
    await showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: AppTokens.brandNavy,
        insetPadding: const EdgeInsets.all(AppTokens.spaceS3),
        child: AspectRatio(aspectRatio: 16 / 9, child: VideoView(url: Uri.parse(v.url))),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final demo = course.demoVideos.isEmpty ? null : course.demoVideos.first;
    return AspectRatio(
      // 16:9, same as the thumbnails, so a cover is never cropped.
      aspectRatio: 16 / 9,
      child: Stack(
        fit: StackFit.expand,
        children: [
          CourseCover(thumbnailUrl: course.thumbnailUrl),
          // A soft navy fade at the bottom so the play label always reads.
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), AppTokens.backdrop], stops: [0.55, 1]),
            ),
          ),
          if (demo != null)
            Center(
              child: Semantics(
                button: true,
                label: l.pWatchDemo,
                child: InkWell(
                  onTap: () => _play(context, demo),
                  customBorder: const CircleBorder(),
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: const BoxDecoration(color: AppTokens.surface, shape: BoxShape.circle, boxShadow: [BoxShadow(color: AppTokens.shadow, blurRadius: 16)]),
                    child: const Icon(Icons.play_arrow_rounded, size: 40, color: AppTokens.actionPrimary),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A key fact (duration, subjects, ...) as a tile: icon in a circle, bold value, grey label.
class _StatTile extends StatelessWidget {
  const _StatTile({required this.icon, required this.value, required this.label});

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS3, vertical: AppTokens.spaceS3),
      decoration: BoxDecoration(color: AppTokens.brandIce, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: const BoxDecoration(color: AppTokens.surface, shape: BoxShape.circle),
            child: Icon(icon, size: 18, color: AppTokens.text),
          ),
          const SizedBox(width: AppTokens.spaceS2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.heading, fontSize: AppTokens.textBase, fontWeight: FontWeight.w800, height: 1.2)),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textXs)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Long text cut to a few lines with "Read more", so the page doesn't start with a wall of words.
class _ExpandableText extends StatefulWidget {
  const _ExpandableText({required this.text});

  final String text;

  @override
  State<_ExpandableText> createState() => _ExpandableTextState();
}

class _ExpandableTextState extends State<_ExpandableText> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final style = Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5);
    return LayoutBuilder(
      builder: (context, box) {
        final painter = TextPainter(text: TextSpan(text: widget.text, style: style), maxLines: 4, textDirection: Directionality.of(context), textScaler: MediaQuery.textScalerOf(context))..layout(maxWidth: box.maxWidth);
        final long = painter.didExceedMaxLines;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.text, maxLines: _open || !long ? null : 4, overflow: TextOverflow.fade, style: style),
            if (long)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(onPressed: () => setState(() => _open = !_open), style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(AppTokens.sizeTapTarget, AppTokens.sizeTapTarget)), child: Text(_open ? l.pReadLess : l.pReadMore)),
              ),
          ],
        );
      },
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS3, vertical: 6),
      decoration: BoxDecoration(color: AppTokens.brandIce, borderRadius: BorderRadius.circular(AppTokens.radiusPill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppTokens.text),
          const SizedBox(width: 6),
          Flexible(child: Text(label, style: const TextStyle(color: AppTokens.text, fontSize: AppTokens.textSm, fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

/// Demo upload videos play only after a tap, so the details page doesn't start streaming by itself.
class _DemoUpload extends StatefulWidget {
  const _DemoUpload({required this.url});
  final String url;
  @override
  State<_DemoUpload> createState() => _DemoUploadState();
}

class _DemoUploadState extends State<_DemoUpload> {
  bool _play = false;
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return _play
        ? VideoView(url: Uri.parse(widget.url))
        : Card(child: ListTile(leading: const Icon(Icons.play_circle_outline), title: Text(l.pOpenVideo), onTap: () => setState(() => _play = true)));
  }
}

/// What the student can do next, from where they stand with this course:
/// Enroll (new or declined), a waiting note (requested), Go to course (enrolled) or a notice (blocked).
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.course, required this.mine, required this.onEnroll, required this.onGoToCourse});

  final CourseDetail course;
  final MyEnrollment? mine;
  final VoidCallback onEnroll;
  final VoidCallback onGoToCourse;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final status = mine?.status;
    Widget note(IconData icon, Color color, String title, String? body) => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(width: AppTokens.spaceS3),
            Expanded(
              child: Column(
                // min: a Column in a bottom bar must wrap its text, or it grows to the whole screen height.
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(color: AppTokens.heading, fontWeight: FontWeight.w800, fontSize: AppTokens.textBase)),
                  if (body != null) Text(body, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm, height: 1.35)),
                ],
              ),
            ),
          ],
        );

    if (status == 'enrolled') {
      return Row(
        children: [
          Expanded(flex: 4, child: note(Icons.check_circle_rounded, AppTokens.brandLime, l.pEnrolledBadge, null)),
          const SizedBox(width: AppTokens.spaceS3),
          Expanded(flex: 5, child: AppButton(label: l.pGoToCourse, expand: true, onPressed: onGoToCourse)),
        ],
      );
    }
    if (status == 'pending') {
      return note(Icons.hourglass_top_rounded, AppTokens.interactive, l.pPendingTitle, l.pPendingNote(mine?.teacher ?? course.teacherName));
    }
    if (status == 'blocked') return note(Icons.block_rounded, AppTokens.error, l.pBlockedNote, null);

    final rejected = status == 'rejected';
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (rejected)
          Padding(
            padding: const EdgeInsets.only(bottom: AppTokens.spaceS2),
            child: Text(
              (mine?.rejectReason ?? '').isEmpty ? l.pRejectedNoReason : l.pRejectedNote(mine!.rejectReason!),
              style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm, height: 1.35),
            ),
          ),
        Row(
          children: [
            if (!rejected && course.feeDisplay != null && course.feeDisplay!.isNotEmpty) ...[
              Flexible(flex: 4, child: FeeText(text: course.feeDisplay!, large: true)),
              const SizedBox(width: AppTokens.spaceS3),
            ],
            Expanded(flex: 5, child: AppButton(label: rejected ? l.pEnrollAgain : l.pEnroll, expand: true, onPressed: onEnroll)),
          ],
        ),
      ],
    );
  }
}
