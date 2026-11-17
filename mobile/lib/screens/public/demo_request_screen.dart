import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import 'otp_form.dart';

class DemoRequestScreen extends ConsumerStatefulWidget {
  const DemoRequestScreen({super.key, required this.slug});
  final String slug;

  @override
  ConsumerState<DemoRequestScreen> createState() => _DemoRequestScreenState();
}

class _DemoRequestScreenState extends ConsumerState<DemoRequestScreen> {
  bool _sent = false;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final repo = ref.read(publicRepositoryProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.sDemoTitle)),
      body: ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        children: [
          if (_sent)
            AppBanner(kind: 'success', message: l.pDemoSent)
          else
            OtpForm(
              extraFields: const ['classStandard', 'preferredTime', 'message'],
              submitLabel: l.pRequestDemo,
              sendOtp: (mobile) => repo.sendOtp(mobile, 'demo_request'),
              submit: (f) async {
                await repo.requestDemo({...f, 'courseSlug': widget.slug});
                if (mounted) setState(() => _sent = true);
              },
            ),
        ],
      ),
    );
  }
}
