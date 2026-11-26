import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/teacher_providers.dart';
import '../../widgets/app_widgets.dart';

/// Asks for the Meet link of a live demo: paste one, or press "Generate link" (the teacher becomes co-host).
/// Returns the link, or null when cancelled. A link is needed before the demo can be scheduled.
Future<String?> askDemoLink(BuildContext context, {required String topic, required DateTime startsAt}) =>
    showDialog<String>(context: context, builder: (_) => DemoLinkDialog(topic: topic, startsAt: startsAt));

class DemoLinkDialog extends ConsumerStatefulWidget {
  const DemoLinkDialog({super.key, required this.topic, required this.startsAt});
  final String topic;
  final DateTime startsAt;

  @override
  ConsumerState<DemoLinkDialog> createState() => _DemoLinkDialogState();
}

class _DemoLinkDialogState extends ConsumerState<DemoLinkDialog> {
  final _link = TextEditingController();
  bool _generating = false;
  String? _error;

  @override
  void dispose() {
    _link.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    setState(() {
      _generating = true;
      _error = null;
    });
    try {
      final link = await ref.read(teacherRepositoryProvider).generateMeetLink(topic: widget.topic, startsAt: widget.startsAt, durationMin: 30);
      if (mounted) setState(() => _link.text = link);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l.tAddMeetLink),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _link,
              keyboardType: TextInputType.url,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(labelText: l.tMeetLinkLabel, hintText: 'https://meet.google.com/abc-defg-hij', helperText: l.tMeetLinkHint, helperMaxLines: 3),
            ),
            const SizedBox(height: AppTokens.spaceS3),
            AppButton(label: l.tGenerateLink, variant: AppButtonVariant.secondary, loading: _generating, onPressed: _generate),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS2), child: Text(_error!, style: const TextStyle(color: AppTokens.errorText, fontWeight: FontWeight.w600))),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l.cancel)),
        FilledButton(onPressed: _link.text.trim().isEmpty ? null : () => Navigator.of(context).pop(_link.text.trim()), child: Text(l.tSaveLink)),
      ],
    );
  }
}
