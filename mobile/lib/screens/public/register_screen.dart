import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import 'otp_form.dart';

/// Student registration. With [slug] (from "Enroll now") the enrollment request is sent right after.
class RegisterScreen extends ConsumerWidget {
  const RegisterScreen({super.key, this.slug});
  final String? slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.pCreateAccount)),
      body: ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        children: [
          TextButton(onPressed: () => context.go('/login'), child: Text(l.pHaveAccount)),
          const SizedBox(height: AppTokens.spaceS3),
          OtpForm(
            extraFields: const ['email', 'classStandard', 'city'],
            requiredFields: const ['email'],
            submitLabel: l.pCreate,
            sendOtp: (mobile) => ref.read(authRepositoryProvider).sendOtp(mobile, 'student_register'),
            submit: (f) async {
              // Read everything before signing in: the router leaves this screen once the session changes.
              final auth = ref.read(authRepositoryProvider);
              final student = ref.read(studentRepositoryProvider);
              final lang = Localizations.localeOf(context).languageCode;
              await auth.registerStudent({...f, 'preferredLang': lang});
              if (slug != null) {
                try {
                  await student.requestEnrollment(slug!, email: f['email'] as String?);
                } on ApiException {
                  // The student can retry from the course page; registration itself succeeded.
                }
              }
            },
          ),
        ],
      ),
    );
  }
}

/// Logged-in student sending an enrollment request for a course.
class EnrollScreen extends ConsumerStatefulWidget {
  const EnrollScreen({super.key, required this.slug});
  final String slug;

  @override
  ConsumerState<EnrollScreen> createState() => _EnrollScreenState();
}

class _EnrollScreenState extends ConsumerState<EnrollScreen> {
  final _message = TextEditingController();
  final _email = TextEditingController();
  bool _busy = false;
  bool _sent = false;
  bool _submitted = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Enroll now always needs an email: fill it from the account, the student can change it.
    Future.microtask(() async {
      try {
        final p = await ref.read(studentProfileProvider.future);
        if (mounted && _email.text.isEmpty && p.email != null) setState(() => _email.text = p.email!);
      } catch (_) {}
    });
  }

  bool get _emailOk => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(_email.text.trim());

  @override
  void dispose() {
    _message.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final course = ref.watch(courseDetailProvider(widget.slug));
    final teacher = course.valueOrNull?.teacherName ?? '';
    return Scaffold(
      appBar: AppBar(title: Text(course.valueOrNull?.title ?? l.pEnroll)),
      body: ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        children: [
          if (_sent) ...[
            AppBanner(kind: 'success', message: l.pEnrollSent(teacher)),
            const SizedBox(height: AppTokens.spaceS4),
            AppButton(label: l.dashboard, onPressed: () => context.go('/student')),
          ] else ...[
            AppTextField(label: l.sEmail, controller: _email, keyboardType: TextInputType.emailAddress, requiredField: true, errorText: _submitted && !_emailOk ? l.requiredField : null),
            AppTextField(label: l.sOptional(l.pMessage), controller: _message, maxLines: 3),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS3), child: AppBanner(kind: 'error', message: _error!)),
            AppButton(
              label: l.pEnrollSend,
              expand: true,
              loading: _busy,
              onPressed: () async {
                setState(() => _submitted = true);
                if (!_emailOk) return;
                setState(() {
                  _busy = true;
                  _error = null;
                });
                try {
                  await ref.read(studentRepositoryProvider).requestEnrollment(widget.slug, message: _message.text, email: _email.text);
                  if (mounted) setState(() => _sent = true);
                } on ApiException catch (e) {
                  if (mounted) setState(() => _error = e.message);
                } finally {
                  if (mounted) setState(() => _busy = false);
                }
              },
            ),
          ],
        ],
      ),
    );
  }
}
