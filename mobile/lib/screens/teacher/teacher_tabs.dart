import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../data/models/teacher_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/teacher_providers.dart';
import '../../presentation/viewModels/teacher_viewmodels.dart';
import '../../widgets/app_widgets.dart';
import '../../widgets/skeleton.dart';
import 'live_class_form_screen.dart';
import 'live_schedule_screen.dart';
import 'demo_link_dialog.dart';

String _when(BuildContext context, DateTime d) => DateFormat.yMMMd(Localizations.localeOf(context).toString()).add_jm().format(d.toLocal());
String _iso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

Future<void> _open(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

void _snack(BuildContext context, String message) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

/// Asks the teacher for a Google Meet link. Returns the trimmed link, or null when cancelled.
/// Returned by [_askMeetLink] when the teacher chose "Generate link" instead of pasting one.
const _generateMarker = '__generate__';

Future<String?> _askMeetLink(BuildContext context) {
  final l = AppLocalizations.of(context);
  final ctrl = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(l.tAddMeetLink),
      content: TextField(
        controller: ctrl,
        keyboardType: TextInputType.url,
        autofocus: true,
        decoration: InputDecoration(labelText: l.tMeetLinkLabel, hintText: 'https://meet.google.com/abc-defg-hij', helperText: l.tMeetLinkHint, helperMaxLines: 3),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text(l.cancel)),
        TextButton(onPressed: () => Navigator.of(ctx).pop(_generateMarker), child: Text(l.tGenerateLink)),
        FilledButton(onPressed: () => ctrl.text.trim().isEmpty ? null : Navigator.of(ctx).pop(ctrl.text.trim()), child: Text(l.tSaveLink)),
      ],
    ),
  );
}

String _msg(AppLocalizations l, String keyOrMessage) => switch (keyOrMessage) {
      'needBatch' => l.needBatch,
      'needDates' => l.needDates,
      'dateOrder' => l.dateOrder,
      'needWhen' => l.needWhen,
      'minReason' => l.minReason,
      'required' => l.requiredField,
      _ => keyOrMessage,
    };

Widget _states<T>(BuildContext context, LoadState<T> s, Future<void> Function() reload, Widget Function(T data) builder) {
  final l = AppLocalizations.of(context);
  if (s.data == null && s.loading) return const ListSkeleton();
  if (s.data == null && s.error != null) return EmptyState(title: s.error!, actionLabel: l.tryAgain, onAction: reload);
  return RefreshIndicator(onRefresh: reload, child: builder(s.data as T));
}

// ---------------- Dashboard ----------------
class DashboardTab extends ConsumerStatefulWidget {
  const DashboardTab({super.key});
  @override
  ConsumerState<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends ConsumerState<DashboardTab> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(teacherDashboardProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final s = ref.watch(teacherDashboardProvider);
    return _states(context, s, () => ref.read(teacherDashboardProvider.notifier).load(), (TeacherDashboardData d) {
      final tiles = [
        (d.pendingDemoRequests, l.tDemoWaiting, Icons.ondemand_video_rounded),
        (d.pendingEnrollments, l.tEnrollWaiting, Icons.how_to_reg_rounded),
        (d.openDoubts, l.tOpenDoubts, Icons.help_rounded),
        (d.activeStudents, l.tActiveStudents, Icons.groups_rounded),
      ];
      return ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        children: [
          for (var r = 0; r < tiles.length; r += 2) ...[
            if (r > 0) const SizedBox(height: AppTokens.spaceS3),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: _StatTile(value: tiles[r].$1, label: tiles[r].$2, icon: tiles[r].$3, highlight: tiles[r].$1 > 0 && r < 2)),
                  const SizedBox(width: AppTokens.spaceS3),
                  Expanded(child: _StatTile(value: tiles[r + 1].$1, label: tiles[r + 1].$2, icon: tiles[r + 1].$3, highlight: tiles[r + 1].$1 > 0 && r < 2)),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppTokens.spaceS5),
          Semantics(header: true, child: Text(l.tToday, style: Theme.of(context).textTheme.titleMedium)),
          const SizedBox(height: AppTokens.spaceS3),
          if (d.todaysClasses.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppTokens.spaceS4),
                child: Row(
                  children: [
                    const Icon(Icons.event_available_rounded, color: AppTokens.textSecondary),
                    const SizedBox(width: AppTokens.spaceS3),
                    Expanded(child: Text(l.tNoClasses, style: Theme.of(context).textTheme.bodySmall)),
                  ],
                ),
              ),
            ),
          for (final c in d.todaysClasses)
            Card(
              child: ListTile(
                leading: Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: AppTokens.brandIce, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
                  child: Text(DateFormat.jm().format(c.startsAt.toLocal()), textAlign: TextAlign.center, style: const TextStyle(color: AppTokens.text, fontSize: AppTokens.textXs, fontWeight: FontWeight.w800, height: 1.15)),
                ),
                title: Text(c.topic),
                subtitle: Text('${c.course}${c.batch != null ? ' · ${c.batch}' : ''}'),
                trailing: c.meetLink != null
                    ? AppButton(label: l.join, onPressed: () => _open(c.meetLink!))
                    : AppButton(
                        label: l.tAddMeetLink,
                        variant: AppButtonVariant.secondary,
                        onPressed: () async {
                          final link = await _askMeetLink(context);
                          if (link == null) return;
                          try {
                            if (link == _generateMarker) {
                              await ref.read(teacherRepositoryProvider).generateClassLink(c.id);
                            } else {
                              await ref.read(teacherRepositoryProvider).setMeetLink(c.id, link);
                            }
                            await ref.read(teacherDashboardProvider.notifier).load();
                          } on ApiException catch (e) {
                            if (context.mounted) _snack(context, e.message);
                          }
                        },
                      ),
              ),
            ),
        ],
      );
    });
  }
}

// ---------------- Requests ----------------
class RequestsTab extends ConsumerStatefulWidget {
  const RequestsTab({super.key});
  @override
  ConsumerState<RequestsTab> createState() => _RequestsTabState();
}

class _RequestsTabState extends ConsumerState<RequestsTab> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(requestsProvider.notifier).load());
  }

  Future<void> _schedule(DemoRequest r) async {
    final l = AppLocalizations.of(context);
    final date = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: DateTime.now().add(const Duration(days: 1)));
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (time == null || !mounted) return;
    final when = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    // The demo needs a Meet link before it can be scheduled: pasted, or made with "Generate link".
    final link = await askDemoLink(context, topic: 'Demo: ${r.courseTitle}', startsAt: when);
    if (link == null || !mounted) return;
    final err = await ref.read(requestsProvider.notifier).schedule(r.id, when, meetLink: link);
    if (mounted) _snack(context, err == null ? l.saved : _msg(l, err));
  }

  Future<void> _whatsApp(DemoRequest r) async {
    final l = AppLocalizations.of(context);
    final res = await ref.read(requestsProvider.notifier).sendWhatsApp(r.id);
    if (!mounted) return;
    if (res.sent) return _snack(context, l.waSent);
    _snack(context, res.message ?? l.waNotSent);
    if (res.fallbackUrl != null) await _open(res.fallbackUrl!);
  }

  Future<void> _approve(EnrollmentRequest e) async {
    final err = await showModalBottomSheet<String?>(context: context, isScrollControlled: true, builder: (_) => ApproveSheet(enrollment: e));
    if (err == null && mounted) _snack(context, AppLocalizations.of(context).approvedMsg);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final s = ref.watch(requestsProvider);
    if (s.loading && s.demos.isEmpty && s.enrollments.isEmpty) return const Center(child: CircularProgressIndicator());
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          TabBar(tabs: [Tab(text: l.tDemoTab), Tab(text: l.tEnrollTab)]),
          if (s.error != null) Padding(padding: const EdgeInsets.all(AppTokens.spaceS3), child: AppBanner(message: s.error!, kind: 'error')),
          Expanded(
            child: TabBarView(children: [
              RefreshIndicator(
                onRefresh: () => ref.read(requestsProvider.notifier).load(),
                child: s.demos.isEmpty
                    ? ListView(children: [EmptyState(title: l.tNoDemos)])
                    : ListView(
                        padding: const EdgeInsets.all(AppTokens.spaceS3),
                        children: [
                          for (final r in s.demos)
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(AppTokens.spaceS3),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(children: [Expanded(child: Text(r.name, style: Theme.of(context).textTheme.titleMedium)), StatusBadge(status: r.status, label: r.status)]),
                                    Text('${r.courseTitle} · ${r.education} · ${r.mobile}', style: Theme.of(context).textTheme.bodySmall),
                                    if (r.scheduledAt != null) Text(_when(context, r.scheduledAt!)),
                                    const SizedBox(height: AppTokens.spaceS2),
                                    Wrap(spacing: AppTokens.spaceS2, runSpacing: AppTokens.spaceS2, children: [
                                      if (r.status == 'pending' || r.status == 'scheduled')
                                        AppButton(label: r.status == 'pending' ? l.schedule : l.reschedule, variant: AppButtonVariant.compact, onPressed: () => _schedule(r)),
                                      if (r.status == 'scheduled')
                                        AppButton(
                                          label: s.whatsApp[r.id]?.sent == true || r.whatsappSentAt != null ? l.waSent : l.sendWhatsApp,
                                          variant: AppButtonVariant.secondary,
                                          onPressed: s.whatsApp[r.id]?.sent == true ? null : () => _whatsApp(r),
                                        ),
                                    ]),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
              ),
              RefreshIndicator(
                onRefresh: () => ref.read(requestsProvider.notifier).load(),
                child: s.enrollments.isEmpty
                    ? ListView(children: [EmptyState(title: l.tNoEnrollments)])
                    : ListView(
                        padding: const EdgeInsets.all(AppTokens.spaceS3),
                        children: [
                          for (final e in s.enrollments)
                            Card(
                              child: ListTile(
                                title: Text(e.studentName),
                                subtitle: Text('${e.courseTitle} · ${e.studentMobile}'),
                                trailing: AppButton(label: l.approve, variant: AppButtonVariant.compact, onPressed: () => _approve(e)),
                              ),
                            ),
                        ],
                      ),
              ),
            ]),
          ),
        ],
      ),
    );
  }
}

/// Approve with a batch and the access period (DECISIONS: batch is required).
class ApproveSheet extends ConsumerStatefulWidget {
  const ApproveSheet({super.key, required this.enrollment});
  final EnrollmentRequest enrollment;
  @override
  ConsumerState<ApproveSheet> createState() => _ApproveSheetState();
}

class _ApproveSheetState extends ConsumerState<ApproveSheet> {
  int? _batch;
  DateTime _start = DateTime.now();
  DateTime? _end;
  String? _error;
  bool _busy = false;

  Future<DateTime?> _pick(DateTime initial) =>
      showDatePicker(context: context, initialDate: initial, firstDate: DateTime(2020), lastDate: DateTime(2100));

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final batches = ref.watch(batchesProvider(widget.enrollment.courseId));
    return Padding(
      padding: EdgeInsets.fromLTRB(AppTokens.spaceS4, AppTokens.spaceS4, AppTokens.spaceS4, MediaQuery.of(context).viewInsets.bottom + AppTokens.spaceS4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.approveTitle(widget.enrollment.studentName), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppTokens.spaceS3),
          batches.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text('$e'),
            data: (list) => DropdownButtonFormField<int>(
              initialValue: _batch,
              decoration: InputDecoration(labelText: l.batch),
              items: [for (final b in list.where((b) => b.status == 'active')) DropdownMenuItem(value: b.id, child: Text(b.maxStudents != null ? '${b.name} (${b.studentCount}/${b.maxStudents})' : b.name))],
              onChanged: (v) => setState(() => _batch = v),
            ),
          ),
          const SizedBox(height: AppTokens.spaceS3),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () async { final d = await _pick(_start); if (d != null) setState(() => _start = d); }, child: Text('${l.startDate}: ${_iso(_start)}'))),
            const SizedBox(width: AppTokens.spaceS2),
            Expanded(child: OutlinedButton(onPressed: () async { final d = await _pick(_end ?? _start.add(const Duration(days: 365))); if (d != null) setState(() => _end = d); }, child: Text('${l.endDate}: ${_end == null ? '—' : _iso(_end!)}'))),
          ]),
          if (_error != null) ...[const SizedBox(height: AppTokens.spaceS2), Text(_error!, style: const TextStyle(color: AppTokens.errorText))],
          const SizedBox(height: AppTokens.spaceS4),
          AppButton(
            label: l.approveStudent,
            loading: _busy,
            expand: true,
            onPressed: () async {
              setState(() => _busy = true);
              final err = await ref.read(requestsProvider.notifier).approve(widget.enrollment.id, batchId: _batch, startDate: _iso(_start), endDate: _end == null ? '' : _iso(_end!));
              if (!context.mounted) return;
              setState(() => _busy = false);
              if (err == null) {
                Navigator.of(context).pop(null);
              } else {
                setState(() => _error = _msg(l, err));
              }
            },
          ),
        ],
      ),
    );
  }
}

// ---------------- Students ----------------
class StudentsTab extends ConsumerStatefulWidget {
  const StudentsTab({super.key});
  @override
  ConsumerState<StudentsTab> createState() => _StudentsTabState();
}

class _StudentsTabState extends ConsumerState<StudentsTab> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(studentsProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final s = ref.watch(studentsProvider);
    return _states(context, s, () => ref.read(studentsProvider.notifier).load(), (List<StudentRow> list) {
      if (list.isEmpty) return ListView(children: [EmptyState(title: l.tNoStudents)]);
      return ListView.separated(
        padding: const EdgeInsets.all(AppTokens.spaceS3),
        itemCount: list.length,
        separatorBuilder: (_, _) => const SizedBox(height: AppTokens.spaceS2),
        itemBuilder: (_, i) {
          final st = list[i];
          return Card(
            child: SwitchListTile(
              title: Text(st.name),
              subtitle: Text('${st.courseTitle}${st.batchName != null ? ' · ${st.batchName}' : ''}\n${l.accessUntil(st.endDate ?? '—')}'),
              isThreeLine: true,
              value: st.accessEnabled,
              onChanged: (v) async {
                final err = await ref.read(studentsProvider.notifier).setAccess(st, v);
                if (err != null && context.mounted) _snack(context, err);
              },
            ),
          );
        },
      );
    });
  }
}

// ---------------- Live classes + attendance ----------------
class ClassesTab extends ConsumerStatefulWidget {
  const ClassesTab({super.key});
  @override
  ConsumerState<ClassesTab> createState() => _ClassesTabState();
}

class _ClassesTabState extends ConsumerState<ClassesTab> {
  int? _courseFilter; // null = all courses

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(liveClassesProvider.notifier).load());
  }

  Future<void> _openForm([LiveClass? item]) async {
    final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => LiveClassFormScreen(item: item)));
    if (saved == true && mounted) await ref.read(liveClassesProvider.notifier).load();
  }

  Future<void> _cancel(LiveClass c) async {
    final l = AppLocalizations.of(context);
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.tCancelClass),
        content: Text(l.tCancelClassAsk),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.tKeepClass)),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.tCancelClass)),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    final error = await ref.read(liveClassesProvider.notifier).cancel(c.id);
    if (mounted) _snack(context, error ?? l.tClassCancelled);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final s = ref.watch(liveClassesProvider);
    return _states(context, s, () => ref.read(liveClassesProvider.notifier).load(), (List<LiveClass> all) {
      // Same as the website: filter by course (only courses that have classes), add a class, open a batch's schedule.
      final courses = <int, String>{for (final c in all) c.courseId: c.courseTitle};
      final filter = courses.containsKey(_courseFilter) ? _courseFilter : null;
      final list = filter == null ? all : all.where((c) => c.courseId == filter).toList();
      final header = Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<int?>(
              key: ValueKey('filter-$filter-${courses.length}'),
              initialValue: filter,
              isExpanded: true,
              decoration: const InputDecoration(prefixIcon: Icon(Icons.filter_list_rounded), contentPadding: EdgeInsets.symmetric(horizontal: AppTokens.spaceS2, vertical: AppTokens.spaceS2)),
              items: [
                DropdownMenuItem<int?>(value: null, child: Text(l.tAllCourses, overflow: TextOverflow.ellipsis)),
                for (final e in courses.entries) DropdownMenuItem<int?>(value: e.key, child: Text(e.value, overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => setState(() => _courseFilter = v),
            ),
          ),
          const SizedBox(width: AppTokens.spaceS2),
          IconButton.filledTonal(
            tooltip: l.tLiveSchedule,
            icon: const Icon(Icons.calendar_month_rounded),
            onPressed: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => const LiveSchedulePicker()),
          ),
          const SizedBox(width: AppTokens.spaceS1),
          IconButton.filled(
            tooltip: l.tAddLiveClass,
            style: IconButton.styleFrom(backgroundColor: AppTokens.actionPrimary, foregroundColor: AppTokens.actionPrimaryText),
            icon: const Icon(Icons.add_rounded),
            onPressed: _openForm,
          ),
        ],
      );
      return ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS3),
        children: [
          header,
          if (list.isEmpty) EmptyState(title: l.tNoClasses, actionLabel: l.tAddLiveClass, onAction: _openForm),
          for (final c in list)
            _ClassCard(
              c: c,
              when: _when(context, c.startsAt),
              onJoin: c.status != 'cancelled' && c.meetLink != null ? () => _open(c.meetLink!) : null,
              onAddLink: !c.needsMeetLink
                  ? null
                  : () async {
                      final link = await _askMeetLink(context);
                      if (link == null) return;
                      final vm = ref.read(liveClassesProvider.notifier);
                      final error = link == _generateMarker ? await vm.generateLink(c.id) : await vm.setMeetLink(c.id, link);
                      if (error != null && context.mounted) _snack(context, error);
                    },
              onAttendance: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => AttendanceScreen(liveClass: c))),
              onEdit: c.status == 'cancelled' ? null : () => _openForm(c),
              onCancel: c.status == 'scheduled' ? () => _cancel(c) : null,
            ),
        ],
      );
    });
  }
}

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key, required this.liveClass});
  final LiveClass liveClass;
  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(attendanceProvider(widget.liveClass.id).notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final provider = attendanceProvider(widget.liveClass.id);
    final s = ref.watch(provider);
    final vm = ref.read(provider.notifier);
    final rows = s.data ?? const <AttendanceRow>[];
    return Scaffold(
      appBar: AppBar(title: Text(widget.liveClass.topic)),
      body: s.data == null
          ? (s.error != null ? EmptyState(title: s.error!) : const Center(child: CircularProgressIndicator()))
          : ListView(
              padding: const EdgeInsets.all(AppTokens.spaceS3),
              children: [
                Row(children: [
                  AppButton(label: l.markAllPresent, variant: AppButtonVariant.compact, onPressed: vm.markAllPresent),
                  const SizedBox(width: AppTokens.spaceS3),
                  Text(l.presentCount(rows.where((r) => r.present == true).length, rows.length)),
                ]),
                const SizedBox(height: AppTokens.spaceS3),
                if (rows.isEmpty) EmptyState(title: l.tNoStudents),
                for (final r in rows)
                  Card(
                    child: ListTile(
                      title: Text(r.name),
                      trailing: SegmentedButton<bool>(
                        segments: [ButtonSegment(value: true, label: Text(l.present)), ButtonSegment(value: false, label: Text(l.absent))],
                        selected: r.present == null ? <bool>{} : {r.present!},
                        emptySelectionAllowed: true,
                        onSelectionChanged: (sel) => sel.isEmpty ? null : vm.mark(r.studentPublicId, sel.first),
                      ),
                    ),
                  ),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spaceS3),
          child: AppButton(
            label: l.saveAttendance,
            loading: _saving,
            expand: true,
            onPressed: rows.isEmpty
                ? null
                : () async {
                    setState(() => _saving = true);
                    final err = await vm.save();
                    if (!context.mounted) return;
                    setState(() => _saving = false);
                    _snack(context, err ?? l.saved);
                  },
          ),
        ),
      ),
    );
  }
}

// ---------------- Doubts ----------------
class DoubtsTab extends ConsumerStatefulWidget {
  const DoubtsTab({super.key});
  @override
  ConsumerState<DoubtsTab> createState() => _DoubtsTabState();
}

class _DoubtsTabState extends ConsumerState<DoubtsTab> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(doubtsProvider.notifier).load());
  }

  Future<void> _reply(Doubt d) async {
    final l = AppLocalizations.of(context);
    final ctrl = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.replyTo(d.studentName)),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(d.question),
          const SizedBox(height: AppTokens.spaceS3),
          TextField(controller: ctrl, maxLines: 4, maxLength: 2000, decoration: InputDecoration(labelText: l.yourReply)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.cancel)),
          AppButton(label: l.sendReply, onPressed: () => Navigator.pop(ctx, ctrl.text)),
        ],
      ),
    );
    ctrl.dispose();
    if (text == null || !mounted) return;
    final err = await ref.read(doubtsProvider.notifier).reply(d.id, text);
    if (mounted) _snack(context, err == null ? l.replySent : _msg(l, err));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final s = ref.watch(doubtsProvider);
    return _states(context, s, () => ref.read(doubtsProvider.notifier).load(), (List<Doubt> list) {
      if (list.isEmpty) return ListView(children: [EmptyState(title: l.tNoDoubts)]);
      return ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS3),
        children: [
          for (final d in list)
            Card(
              child: ListTile(
                title: Text(d.question),
                subtitle: Text('${d.studentName} · ${d.courseTitle}'),
                trailing: AppButton(label: l.reply, variant: AppButtonVariant.compact, onPressed: () => _reply(d)),
              ),
            ),
        ],
      );
    });
  }
}

/// One dashboard number. Grows with its text, so a long label or a bigger font never overflows.
class _StatTile extends StatelessWidget {
  const _StatTile({required this.value, required this.label, required this.icon, this.highlight = false});

  final int value;
  final String label;
  final IconData icon;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spaceS3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: highlight ? AppTokens.actionPrimary : AppTokens.brandIce,
                    borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                  ),
                  child: Icon(icon, size: 20, color: highlight ? AppTokens.actionPrimaryText : AppTokens.text),
                ),
                const Spacer(),
                Text('$value', style: const TextStyle(color: AppTokens.heading, fontSize: AppTokens.textXl, fontWeight: FontWeight.w800, height: 1.1)),
              ],
            ),
            const SizedBox(height: AppTokens.spaceS3),
            Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.25, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

/// One live class: topic and status, time, course and batch, then the actions in a row.
class _ClassCard extends StatelessWidget {
  const _ClassCard({required this.c, required this.when, required this.onJoin, required this.onAddLink, required this.onAttendance, this.onEdit, this.onCancel});

  final LiveClass c;
  final String when;
  final VoidCallback? onJoin;
  final VoidCallback? onAddLink;
  final VoidCallback onAttendance;
  final VoidCallback? onEdit;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final where = '${c.courseTitle} · ${c.batchName ?? l.tAllBatches}';
    return Card(
      margin: const EdgeInsets.only(top: AppTokens.spaceS2),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppTokens.spaceS3, AppTokens.spaceS2, AppTokens.spaceS1, AppTokens.spaceS2),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(child: Text(c.topic, style: text.titleMedium)),
                const SizedBox(width: AppTokens.spaceS2),
                StatusBadge(status: c.status, label: c.status),
                if (onEdit != null || onCancel != null)
                  PopupMenuButton<String>(
                    tooltip: '',
                    icon: const Icon(Icons.more_vert_rounded, color: AppTokens.textSecondary),
                    onSelected: (v) => v == 'edit' ? onEdit?.call() : onCancel?.call(),
                    itemBuilder: (_) => [
                      if (onEdit != null) PopupMenuItem(value: 'edit', child: Text(l.tEditClass)),
                      if (onCancel != null) PopupMenuItem(value: 'cancel', child: Text(l.tCancelClass)),
                    ],
                  )
                else
                  const SizedBox(width: AppTokens.spaceS2),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(right: AppTokens.spaceS2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.schedule_rounded, size: 16, color: AppTokens.textSecondary),
                      const SizedBox(width: 4),
                      Text(when, style: text.bodySmall?.copyWith(color: AppTokens.text, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(where, style: text.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: AppTokens.spaceS2),
                  Row(
                    children: [
                      if (onJoin != null) ...[
                        Expanded(child: AppButton(label: l.join, expand: true, dense: true, onPressed: onJoin)),
                        const SizedBox(width: AppTokens.spaceS2),
                      ],
                      if (onAddLink != null) ...[
                        Expanded(child: AppButton(label: l.tAddMeetLink, expand: true, dense: true, variant: AppButtonVariant.secondary, onPressed: onAddLink)),
                        const SizedBox(width: AppTokens.spaceS2),
                      ],
                      Expanded(child: AppButton(label: l.attendance, expand: true, dense: true, variant: AppButtonVariant.secondary, onPressed: onAttendance)),
                    ],
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
