import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../data/models/teacher_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/teacher_providers.dart';
import '../../widgets/app_widgets.dart';
import '../student/widgets/common.dart';
import '../student/widgets/lesson_row.dart';

/// Asks for a date, then a time. Returns null when either is cancelled.
Future<DateTime?> pickLiveDateTime(BuildContext context) async {
  final now = DateTime.now();
  final date = await showDatePicker(context: context, firstDate: now, lastDate: DateTime(now.year + 3), initialDate: now);
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 18, minute: 0));
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

/// Live schedule of one batch: every live lesson of the course. Lessons the batch has no session of
/// get a date here; one save schedules all of them (all or nothing on the server).
class LiveScheduleScreen extends ConsumerStatefulWidget {
  const LiveScheduleScreen({super.key, required this.courseId, required this.batchId, required this.batchName, this.pickDateTime = pickLiveDateTime});
  final int courseId;
  final int batchId;
  final String batchName;
  final Future<DateTime?> Function(BuildContext context) pickDateTime;

  @override
  ConsumerState<LiveScheduleScreen> createState() => _LiveScheduleScreenState();
}

class _LiveScheduleScreenState extends ConsumerState<LiveScheduleScreen> {
  List<LiveScheduleRow>? _rows;
  String? _error;
  bool _saving = false;
  final _dates = <String, DateTime>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final rows = await ref.read(teacherRepositoryProvider).liveSchedule(widget.courseId, widget.batchId);
      if (mounted) setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _pick(LiveScheduleRow r) async {
    final d = await widget.pickDateTime(context);
    if (d != null && mounted) setState(() => _dates[r.slotId] = d);
  }

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    if (_dates.isEmpty) return setState(() => _error = l.tLiveScheduleNothing);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(teacherRepositoryProvider).saveLiveSchedule(widget.courseId, widget.batchId, Map.of(_dates));
      _dates.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final rows = _rows;
    return Scaffold(
      appBar: AppBar(title: Text('${l.tLiveSchedule}: ${widget.batchName}')),
      body: rows == null && _error == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(AppTokens.spaceS3),
              children: [
                Text(l.tLiveScheduleIntro, style: const TextStyle(color: AppTokens.textSecondary)),
                const SizedBox(height: AppTokens.spaceS3),
                if (rows != null && rows.isEmpty) EmptyState(title: l.tLiveScheduleEmpty),
                for (final r in rows ?? const <LiveScheduleRow>[])
                  Card(
                    child: ListTile(
                      title: Text(r.title),
                      subtitle: Text(r.scheduled
                          ? '${r.moduleName} · ${formatDateTime(context, r.startsAt!)}'
                          : (_dates[r.slotId] == null ? r.moduleName : '${r.moduleName} · ${formatDateTime(context, _dates[r.slotId]!)}')),
                      trailing: r.scheduled
                          ? LiveStageChip(stage: r.stage ?? 'upcoming')
                          : AppButton(label: l.tSetDate, variant: AppButtonVariant.compact, onPressed: () => _pick(r)),
                    ),
                  ),
                if (_error != null) Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS2), child: Text(_error!, style: const TextStyle(color: AppTokens.functionalError))),
                const SizedBox(height: AppTokens.spaceS3),
                if (rows != null && rows.isNotEmpty) AppButton(label: l.tLiveScheduleSave, loading: _saving, onPressed: _save),
              ],
            ),
    );
  }
}

/// Picks a course and a batch, then opens that batch's live schedule.
class LiveSchedulePicker extends ConsumerStatefulWidget {
  const LiveSchedulePicker({super.key});
  @override
  ConsumerState<LiveSchedulePicker> createState() => _LiveSchedulePickerState();
}

class _LiveSchedulePickerState extends ConsumerState<LiveSchedulePicker> {
  List<TeacherCourseRef>? _courses;
  List<Batch> _batches = const [];
  TeacherCourseRef? _course;
  Batch? _batch;

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      final c = await ref.read(teacherRepositoryProvider).courses();
      if (mounted) setState(() => _courses = c);
    });
  }

  Future<void> _chooseCourse(TeacherCourseRef? c) async {
    setState(() {
      _course = c;
      _batch = null;
      _batches = const [];
    });
    if (c == null) return;
    final b = await ref.read(teacherRepositoryProvider).batches(c.id);
    if (mounted) setState(() => _batches = b.where((x) => x.status != 'closed').toList());
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final courses = _courses;
    return Padding(
      padding: const EdgeInsets.all(AppTokens.spaceS3),
      child: courses == null
          ? const Center(heightFactor: 3, child: CircularProgressIndicator())
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(l.tLiveSchedule, style: Theme.of(context).textTheme.titleMedium),
                DropdownButtonFormField<TeacherCourseRef>(
                  initialValue: _course,
                  decoration: InputDecoration(labelText: l.tChooseCourse),
                  items: [for (final c in courses) DropdownMenuItem(value: c, child: Text(c.title))],
                  onChanged: _chooseCourse,
                ),
                DropdownButtonFormField<Batch>(
                  key: ValueKey(_course?.id),
                  initialValue: _batch,
                  decoration: InputDecoration(labelText: l.tChooseBatch),
                  items: [for (final b in _batches) DropdownMenuItem(value: b, child: Text(b.name))],
                  onChanged: (b) => setState(() => _batch = b),
                ),
                const SizedBox(height: AppTokens.spaceS3),
                AppButton(
                  label: l.tOpenSchedule,
                  onPressed: _course == null || _batch == null
                      ? null
                      : () {
                          final nav = Navigator.of(context);
                          nav.pop();
                          nav.push(MaterialPageRoute<void>(builder: (_) => LiveScheduleScreen(courseId: _course!.id, batchId: _batch!.id, batchName: _batch!.name)));
                        },
                ),
              ],
            ),
    );
  }
}
