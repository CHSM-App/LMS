import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
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
              ? ListView(children: [EmptyState(title: l.sNoUpcoming)])
              : ListView(
                  padding: const EdgeInsets.all(AppTokens.spaceS4),
                  children: [for (final c in list) LiveClassTile(liveClassId: c.id, topic: c.topic, subtitle: [c.course, ?c.batch, formatDateTime(context, c.startsAt)].join(' · '), meetLink: c.canJoin ? c.meetLink : null, waitingForLink: c.waitingForLink)],
                ),
        ),
      ),
    );
  }
}

class StudentDoubtsScreen extends ConsumerStatefulWidget {
  const StudentDoubtsScreen({super.key});

  @override
  ConsumerState<StudentDoubtsScreen> createState() => _StudentDoubtsScreenState();
}

class _StudentDoubtsScreenState extends ConsumerState<StudentDoubtsScreen> {
  final _q = TextEditingController();
  int? _courseId;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _ask(AppLocalizations l) async {
    if (_courseId == null) return setState(() => _error = l.sNeedCourse);
    if (_q.text.trim().isEmpty) return setState(() => _error = l.requiredField);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(studentRepositoryProvider).askDoubt(_courseId!, _q.text);
      _q.clear();
      ref.invalidate(studentDoubtsProvider);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.sDoubtSent)));
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
    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppTokens.spaceS4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(l.sAskDoubt, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppTokens.spaceS3),
                  DropdownButtonFormField<int>(
                    initialValue: _courseId,
                    decoration: InputDecoration(labelText: l.sChooseCourse),
                    items: [for (final c in courses) DropdownMenuItem(value: c.courseId, child: Text(c.title, overflow: TextOverflow.ellipsis))],
                    onChanged: (v) => setState(() => _courseId = v),
                  ),
                  const SizedBox(height: AppTokens.spaceS3),
                  AppTextField(label: l.sQuestion, controller: _q, maxLines: 4, requiredField: true),
                  if (_error != null) Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS2), child: AppBanner(kind: 'error', message: _error!)),
                  AppButton(label: l.sSendToTeacher, loading: _busy, onPressed: () => _ask(l)),
                ],
              ),
            ),
          ),
          AsyncView<List<StudentDoubt>>(
            value: ref.watch(studentDoubtsProvider),
            onRetry: () => ref.invalidate(studentDoubtsProvider),
            builder: (list) => list.isEmpty
                ? EmptyState(title: l.sNoDoubts)
                : Column(children: [
                    for (final d in list)
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(AppTokens.spaceS4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Expanded(child: Text('${d.courseTitle} · ${formatDate(context, d.createdAt)}', style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm))),
                                StatusBadge(status: d.status, label: d.status),
                              ]),
                              const SizedBox(height: AppTokens.spaceS2),
                              Text(d.question),
                              const SizedBox(height: AppTokens.spaceS2),
                              Text(d.reply ?? l.sWaitingReply, style: TextStyle(color: d.reply == null ? AppTokens.textSecondary : AppTokens.text, fontWeight: d.reply == null ? FontWeight.w400 : FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                  ]),
          ),
        ],
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
                  ListTile(
                    leading: Icon(n.isRead ? Icons.notifications_none : Icons.notifications_active, color: n.isRead ? AppTokens.textSecondary : AppTokens.actionPrimary),
                    title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.w400 : FontWeight.w700)),
                    subtitle: Text('${n.message}\n${formatDateTime(context, n.createdAt)}'),
                    isThreeLine: true,
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
    Widget item(IconData icon, String label, VoidCallback onTap) => ListTile(leading: Icon(icon), title: Text(label), trailing: const Icon(Icons.chevron_right), onTap: onTap);
    return Scaffold(
      body: ListView(
        children: [
          item(Icons.insights_outlined, l.sProgress, () => context.push('/student/progress')),
          item(Icons.download_for_offline_outlined, l.sDownloads, () => context.push('/student/downloads')),
          item(Icons.notifications_none, l.sNotifications, () => context.push('/student/notifications')),
          item(Icons.person_outline, l.sProfile, () => context.push('/student/profile')),
          item(Icons.manage_accounts_outlined, l.account, () => context.push('/account')),
          item(Icons.search, l.sBrowse, () => context.push('/courses')),
          const Divider(),
          ListTile(leading: const Icon(Icons.logout), title: Text(l.logout), onTap: () => logoutStudent(ref)),
        ],
      ),
    );
  }
}
