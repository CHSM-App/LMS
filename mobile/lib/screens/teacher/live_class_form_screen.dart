import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../data/models/teacher_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/teacher_providers.dart';
import '../../widgets/app_widgets.dart';
import 'live_schedule_screen.dart' show pickLiveDateTime;

/// Add or edit one live class, with the same fields as the website: course, batch, topic, date and time,
/// duration and an optional Meet link. [item] null = new class.
class LiveClassFormScreen extends ConsumerStatefulWidget {
  const LiveClassFormScreen({super.key, this.item, this.pickDateTime = pickLiveDateTime});
  final LiveClass? item;
  final Future<DateTime?> Function(BuildContext context) pickDateTime;

  @override
  ConsumerState<LiveClassFormScreen> createState() => _LiveClassFormScreenState();
}

class _LiveClassFormScreenState extends ConsumerState<LiveClassFormScreen> {
  late final _topic = TextEditingController(text: widget.item?.topic ?? '');
  late final _duration = TextEditingController(text: '${widget.item?.durationMin ?? 60}');
  late final _meet = TextEditingController(text: widget.item?.meetLink ?? '');
  List<TeacherCourseRef>? _courses;
  List<Batch> _batches = const [];
  int? _courseId;
  int? _batchId; // null = all batches
  DateTime? _startsAt;
  bool _saving = false;
  bool _generating = false;
  bool _submitted = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final it = widget.item;
    if (it != null) {
      _courseId = it.courseId;
      _batchId = it.batchId;
      _startsAt = it.startsAt.toLocal();
    }
    Future.microtask(_loadCourses);
  }

  @override
  void dispose() {
    _topic.dispose();
    _duration.dispose();
    _meet.dispose();
    super.dispose();
  }

  Future<void> _loadCourses() async {
    try {
      final c = await ref.read(teacherRepositoryProvider).courses();
      if (!mounted) return;
      setState(() => _courses = c);
      if (_courseId != null) await _loadBatches(_courseId!);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _loadBatches(int courseId) async {
    final b = await ref.read(teacherRepositoryProvider).batches(courseId);
    if (!mounted) return;
    setState(() {
      _batches = b.where((x) => x.status != 'closed' || x.id == _batchId).toList();
      if (_batchId != null && !_batches.any((x) => x.id == _batchId)) _batchId = null;
    });
  }

  bool get _durationOk {
    final m = int.tryParse(_duration.text.trim());
    return m != null && m >= 5 && m <= 600;
  }

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    setState(() {
      _submitted = true;
      _error = null;
    });
    if (_courseId == null || _topic.text.trim().isEmpty || _startsAt == null || !_durationOk) return;
    setState(() => _saving = true);
    try {
      await ref.read(teacherRepositoryProvider).saveLiveClass(
            id: widget.item?.id,
            courseId: _courseId!,
            batchId: _batchId,
            topic: _topic.text,
            startsAt: _startsAt!,
            durationMin: int.parse(_duration.text.trim()),
            meetLink: _meet.text,
            status: widget.item?.status ?? 'scheduled',
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.tClassSaved)));
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// "Generate link": needs the topic, date and duration first. Fills the Meet link field; nothing is saved yet.
  Future<void> _generate() async {
    setState(() {
      _submitted = true;
      _error = null;
    });
    if (_topic.text.trim().isEmpty || _startsAt == null || !_durationOk) return;
    setState(() => _generating = true);
    try {
      final link = await ref.read(teacherRepositoryProvider).generateMeetLink(topic: _topic.text, startsAt: _startsAt!, durationMin: int.parse(_duration.text.trim()));
      if (mounted) setState(() => _meet.text = link);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Widget _labeled(String label, Widget child, {bool required = false, String? error}) => Padding(
        padding: const EdgeInsets.only(bottom: AppTokens.spaceS4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(required ? '$label *' : label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTokens.text)),
            const SizedBox(height: AppTokens.spaceS1),
            child,
            if (error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(error, style: const TextStyle(color: AppTokens.errorText, fontWeight: FontWeight.w600))),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final courses = _courses;
    final required = l.requiredField;
    return Scaffold(
      appBar: AppBar(title: Text(widget.item == null ? l.tAddLiveClass : l.tEditLiveClass)),
      body: courses == null
          ? Center(child: _error != null ? Text(_error!) : const CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(AppTokens.spaceS4),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                _labeled(
                  l.tChooseCourse,
                  DropdownButtonFormField<int>(
                    initialValue: _courseId,
                    isExpanded: true,
                    items: [for (final c in courses) DropdownMenuItem(value: c.id, child: Text(c.title, overflow: TextOverflow.ellipsis))],
                    onChanged: (v) {
                      setState(() {
                        _courseId = v;
                        _batchId = null;
                        _batches = const [];
                      });
                      if (v != null) _loadBatches(v);
                    },
                  ),
                  required: true,
                  error: _submitted && _courseId == null ? required : null,
                ),
                _labeled(
                  l.tChooseBatch,
                  DropdownButtonFormField<int?>(
                    key: ValueKey('batch-$_courseId-${_batches.length}'),
                    initialValue: _batchId,
                    isExpanded: true,
                    items: [
                      DropdownMenuItem<int?>(value: null, child: Text(l.tAllBatches)),
                      for (final b in _batches) DropdownMenuItem<int?>(value: b.id, child: Text(b.name, overflow: TextOverflow.ellipsis)),
                    ],
                    onChanged: _courseId == null ? null : (v) => setState(() => _batchId = v),
                  ),
                ),
                AppTextField(label: l.tTopic, controller: _topic, requiredField: true, errorText: _submitted && _topic.text.trim().isEmpty ? required : null),
                _labeled(
                  l.tWhen,
                  InkWell(
                    borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                    onTap: () async {
                      final d = await widget.pickDateTime(context);
                      if (d != null && mounted) setState(() => _startsAt = d);
                    },
                    child: InputDecorator(
                      decoration: const InputDecoration(suffixIcon: Icon(Icons.calendar_month_rounded)),
                      child: Text(
                        _startsAt == null ? l.tPickDateTime : DateFormat.yMMMd(Localizations.localeOf(context).toString()).add_jm().format(_startsAt!),
                        style: TextStyle(color: _startsAt == null ? AppTokens.textSecondary : AppTokens.text, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  required: true,
                  error: _submitted && _startsAt == null ? required : null,
                ),
                AppTextField(
                  label: l.tDuration,
                  controller: _duration,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
                  errorText: _submitted && !_durationOk ? l.tDurationInvalid : null,
                ),
                AppTextField(label: l.sOptional(l.tMeetLinkLabel), controller: _meet, keyboardType: TextInputType.url, hint: 'https://meet.google.com/abc-defg-hij'),
                Align(
                  alignment: Alignment.centerLeft,
                  child: AppButton(label: l.tGenerateLink, variant: AppButtonVariant.secondary, loading: _generating, onPressed: _generate),
                ),
                const SizedBox(height: AppTokens.spaceS3),
                if (_error != null) ...[
                  AppBanner(message: _error!, kind: 'error'),
                  const SizedBox(height: AppTokens.spaceS3),
                ],
                AppButton(label: l.tSaveClass, expand: true, loading: _saving, onPressed: _save),
              ],
            ),
    );
  }
}
