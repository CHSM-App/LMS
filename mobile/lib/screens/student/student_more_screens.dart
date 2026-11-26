import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import 'widgets/common.dart';

class StudentLiveClassesScreen extends ConsumerWidget {
  const StudentLiveClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(studentLiveClassesProvider.future),
        child: AsyncView<List<LiveClassItem>>(
          value: ref.watch(studentLiveClassesProvider),
          onRetry: () => ref.invalidate(studentLiveClassesProvider),
          builder: (list) => list.isEmpty
              ? ListView(children: [EmptyState(title: l.sNoUpcoming, icon: Icons.videocam_off_outlined)])
              : ListView(
                  padding: const EdgeInsets.all(AppTokens.spaceS4),
                  children: [for (final c in list) LiveClassTile(liveClassId: c.id, topic: c.topic, subtitle: [c.course, ?c.batch, formatDateTime(context, c.startsAt)].join(' · '), meetLink: c.canJoin ? c.meetLink : null, waitingForLink: c.waitingForLink)],
                ),
        ),
      ),
    );
  }
}

/// Doubts: my questions and the teacher's answers first, and "Ask a doubt" as one clear button that opens a sheet.
class StudentDoubtsScreen extends ConsumerWidget {
  const StudentDoubtsScreen({super.key});

  Future<void> _ask(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => const _AskDoubtSheet(),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _ask(context),
        backgroundColor: AppTokens.actionPrimary,
        foregroundColor: AppTokens.actionPrimaryText,
        elevation: 2,
        icon: const Icon(Icons.edit_outlined),
        label: Text(l.sAskDoubt, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: AppTokens.textBase)),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(studentDoubtsProvider.future),
        child: AsyncView<List<StudentDoubt>>(
          value: ref.watch(studentDoubtsProvider),
          onRetry: () => ref.invalidate(studentDoubtsProvider),
          builder: (list) => list.isEmpty
              ? ListView(children: [EmptyState(title: l.sNoDoubts, icon: Icons.help_outline_rounded, actionLabel: l.sAskDoubt, onAction: () => _ask(context))])
              : ListView(
                  padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, AppTokens.spaceS4, AppTokens.spaceS4, 96),
                  children: [for (final d in list) _DoubtCard(doubt: d)],
                ),
        ),
      ),
    );
  }
}

/// One question and its answer: the question on top, the teacher's reply in a soft box under it.
class _DoubtCard extends StatelessWidget {
  const _DoubtCard({required this.doubt});

  final StudentDoubt doubt;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final d = doubt;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spaceS3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text('${d.courseTitle} · ${formatDate(context, d.createdAt)}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textXs)),
                ),
                const SizedBox(width: AppTokens.spaceS2),
                StatusBadge(status: d.status, label: d.status),
              ],
            ),
            const SizedBox(height: AppTokens.spaceS2),
            Text(d.question, style: const TextStyle(color: AppTokens.heading, fontSize: AppTokens.textBase, fontWeight: FontWeight.w700, height: 1.4)),
            const SizedBox(height: AppTokens.spaceS3),
            Container(
              padding: const EdgeInsets.all(AppTokens.spaceS3),
              decoration: BoxDecoration(color: d.reply == null ? AppTokens.hoverBg : AppTokens.brandIce, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(d.reply == null ? Icons.schedule_rounded : Icons.school_rounded, size: 18, color: AppTokens.textSecondary),
                  const SizedBox(width: AppTokens.spaceS2),
                  Expanded(
                    child: Text(
                      d.reply ?? l.sWaitingReply,
                      style: TextStyle(color: d.reply == null ? AppTokens.textSecondary : AppTokens.text, fontSize: AppTokens.textSm + 1, fontWeight: d.reply == null ? FontWeight.w500 : FontWeight.w600, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The ask-a-doubt form, in a bottom sheet. With one course it is chosen already.
class _AskDoubtSheet extends ConsumerStatefulWidget {
  const _AskDoubtSheet();

  @override
  ConsumerState<_AskDoubtSheet> createState() => _AskDoubtSheetState();
}

class _AskDoubtSheetState extends ConsumerState<_AskDoubtSheet> {
  final _q = TextEditingController();
  int? _courseId;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _send(AppLocalizations l, int? courseId) async {
    if (courseId == null) return setState(() => _error = l.sNeedCourse);
    if (_q.text.trim().isEmpty) return setState(() => _error = l.requiredField);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(studentRepositoryProvider).askDoubt(courseId, _q.text);
      ref.invalidate(studentDoubtsProvider);
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop();
      messenger.showSnackBar(SnackBar(content: Text(l.sDoubtSent)));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final courses = (ref.watch(studentDashboardProvider).valueOrNull?.myCourses ?? const <MyCourse>[]).where((c) => !c.readOnly).toList();
    final courseId = _courseId ?? (courses.length == 1 ? courses.first.courseId : null);
    return Padding(
      // Lifts the sheet above the keyboard.
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, 0, AppTokens.spaceS4, AppTokens.spaceS4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(header: true, child: Text(l.sAskDoubt, style: Theme.of(context).textTheme.titleMedium)),
            const SizedBox(height: AppTokens.spaceS3),
            DropdownButtonFormField<int>(
              initialValue: courseId,
              // Fills the width, so a long course name is cut with "…" instead of overflowing.
              isExpanded: true,
              decoration: InputDecoration(labelText: l.sChooseCourse),
              items: [for (final c in courses) DropdownMenuItem(value: c.courseId, child: Text(c.title, maxLines: 1, overflow: TextOverflow.ellipsis))],
              onChanged: (v) => setState(() => _courseId = v),
            ),
            const SizedBox(height: AppTokens.spaceS3),
            AppTextField(label: l.sQuestion, controller: _q, maxLines: 4, requiredField: true, autofocus: false),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS3), child: AppBanner(kind: 'error', message: _error!)),
            AppButton(label: l.sSendToTeacher, loading: _busy, expand: true, onPressed: () => _send(l, courseId)),
          ],
        ),
      ),
    );
  }
}

class StudentProgressScreen extends ConsumerWidget {
  const StudentProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.sProgress)),
      body: AsyncView<List<CourseProgress>>(
        value: ref.watch(studentProgressProvider),
        onRetry: () => ref.invalidate(studentProgressProvider),
        builder: (list) => list.isEmpty
            ? EmptyState(title: l.sNoCourses)
            : ListView(
                padding: const EdgeInsets.all(AppTokens.spaceS4),
                children: [
                  for (final c in list)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(AppTokens.spaceS4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(c.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(height: AppTokens.spaceS2),
                            LabeledProgress(value: c.progressPct / 100, semanticLabel: c.title),
                            Text(l.sLessonsDone('${c.completedLessons}', c.totalLessons)),
                            Text(l.sAttendance('${c.attendancePct.round()}', '${c.classesAttended}', '${c.classesHeld}')),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

class StudentProfileScreen extends ConsumerStatefulWidget {
  const StudentProfileScreen({super.key});

  @override
  ConsumerState<StudentProfileScreen> createState() => _StudentProfileScreenState();
}

class _StudentProfileScreenState extends ConsumerState<StudentProfileScreen> {
  final _c = <String, TextEditingController>{for (final k in ['name', 'education', 'classStandard', 'city', 'email']) k: TextEditingController()};
  StudentProfile? _loaded;
  String _lang = 'en';
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _fill(StudentProfile p) {
    _loaded = p;
    _c['name']!.text = p.name;
    _c['education']!.text = p.education ?? '';
    _c['classStandard']!.text = p.classStandard ?? '';
    _c['city']!.text = p.city ?? '';
    _c['email']!.text = p.email ?? '';
    _lang = p.preferredLang;
  }

  Future<void> _save(AppLocalizations l) async {
    String? v(String k) => _c[k]!.text.trim().isEmpty ? null : _c[k]!.text.trim();
    setState(() => _busy = true);
    try {
      await ref.read(studentRepositoryProvider).saveProfile(StudentProfile(
            name: _c['name']!.text.trim(),
            mobile: _loaded!.mobile,
            education: v('education'),
            classStandard: v('classStandard'),
            city: v('city'),
            email: v('email'),
            preferredLang: _lang,
          ));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.saved)));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.sProfile)),
      body: AsyncView<StudentProfile>(
        value: ref.watch(studentProfileProvider),
        onRetry: () => ref.invalidate(studentProfileProvider),
        builder: (p) {
          if (_loaded == null) _fill(p);
          return ListView(
            padding: const EdgeInsets.all(AppTokens.spaceS4),
            children: [
              AppTextField(label: l.sName, controller: _c['name'], requiredField: true),
              AppTextField(label: l.mobileNumber, controller: TextEditingController(text: p.mobile), enabled: false, hint: l.changeMobile),
              AppTextField(label: l.sEducation, controller: _c['education']),
              AppTextField(label: l.sClass, controller: _c['classStandard']),
              AppTextField(label: l.sCity, controller: _c['city']),
              AppTextField(label: l.sEmail, controller: _c['email'], keyboardType: TextInputType.emailAddress),
              DropdownButtonFormField<String>(
                initialValue: _lang,
                decoration: InputDecoration(labelText: l.sLanguage),
                items: const [DropdownMenuItem(value: 'en', child: Text('English')), DropdownMenuItem(value: 'mr', child: Text('मराठी')), DropdownMenuItem(value: 'hi', child: Text('हिन्दी'))],
                onChanged: (v) => setState(() => _lang = v ?? 'en'),
              ),
              const SizedBox(height: AppTokens.spaceS4),
              AppButton(label: l.sSave, loading: _busy, onPressed: () => _save(l)),
            ],
          );
        },
      ),
    );
  }
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.sNotifications), actions: [
        TextButton(
          onPressed: () async {
            await ref.read(studentRepositoryProvider).markAllRead();
            ref.invalidate(notificationsProvider);
          },
          child: Text(l.sMarkAllRead),
        ),
      ]),
      body: AsyncView<List<AppNotification>>(
        value: ref.watch(notificationsProvider),
        onRetry: () => ref.invalidate(notificationsProvider),
        builder: (list) => list.isEmpty
            ? EmptyState(title: l.sNoNotifications)
            : ListView(children: [
                for (final n in list)
                  // Unread ones sit on a soft tint, so the new things stand out at a glance.
                  Container(
                    decoration: BoxDecoration(color: n.isRead ? null : AppTokens.selectedBg, border: const Border(bottom: BorderSide(color: AppTokens.divider))),
                    child: ListTile(
                      leading: Icon(n.isRead ? Icons.notifications_none : Icons.notifications_active, color: n.isRead ? AppTokens.textSecondary : AppTokens.actionPrimary),
                      title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w800)),
                      subtitle: Text('${n.message}\n${formatDateTime(context, n.createdAt)}'),
                      isThreeLine: true,
                    ),
                  ),
              ]),
      ),
    );
  }
}

class StudentMoreScreen extends ConsumerWidget {
  const StudentMoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final user = ref.watch(sessionProvider).user;
    final name = user?.name ?? '';
    Widget item(IconData icon, String label, VoidCallback onTap) => ListTile(
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: AppTokens.brandIce, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
            child: Icon(icon, size: 22, color: AppTokens.text),
          ),
          title: Text(label),
          trailing: const Icon(Icons.chevron_right),
          onTap: onTap,
        );
    Widget group(List<Widget> items) => Card(
          margin: const EdgeInsets.only(bottom: AppTokens.spaceS4),
          child: Column(children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const Divider(height: 1, indent: 68),
              items[i],
            ],
          ]),
        );
    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        children: [
          // Who is logged in, as the first thing on the screen.
          Container(
            margin: const EdgeInsets.only(bottom: AppTokens.spaceS4),
            padding: const EdgeInsets.all(AppTokens.spaceS4),
            decoration: BoxDecoration(color: AppTokens.brandNavy, borderRadius: BorderRadius.circular(AppTokens.radiusLg + 4)),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppTokens.actionPrimary,
                  child: Text(name.trim().isEmpty ? '?' : name.trim().characters.first.toUpperCase(), style: const TextStyle(color: AppTokens.actionPrimaryText, fontSize: AppTokens.textLg, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: AppTokens.spaceS3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.navText, fontSize: AppTokens.textMd, fontWeight: FontWeight.w800)),
                      if (user != null && user.mobile.isNotEmpty) Text(user.mobile, style: const TextStyle(color: AppTokens.navTextMuted, fontSize: AppTokens.textSm)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          group([
            item(Icons.insights_outlined, l.sProgress, () => context.push('/student/progress')),
            item(Icons.download_for_offline_outlined, l.sDownloads, () => context.push('/student/downloads')),
            item(Icons.notifications_none, l.sNotifications, () => context.push('/student/notifications')),
          ]),
          group([
            item(Icons.person_outline, l.sProfile, () => context.push('/student/profile')),
            item(Icons.manage_accounts_outlined, l.account, () => context.push('/account')),
            item(Icons.search, l.sBrowse, () => context.push('/courses')),
          ]),
          group([item(Icons.logout, l.logout, () => logoutStudent(ref))]),
        ],
      ),
    );
  }
}
