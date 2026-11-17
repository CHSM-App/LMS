import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../presentation/viewModels/login_viewmodel.dart';
import '../../widgets/app_widgets.dart';

/// Change mobile number and delete account (DECISIONS.md; required by Google Play).
class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  final _newMobile = TextEditingController();
  bool _changeOtpSent = false;
  bool _deleteOtpSent = false;
  bool _busy = false;
  String _changeOtp = '';
  String _deleteOtp = '';
  String? _error;

  @override
  void dispose() {
    _newMobile.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = ref.read(apiClientProvider);
    final user = ref.watch(sessionProvider).user;
    if (user == null) return const SizedBox.shrink();

    return Scaffold(
      appBar: AppBar(title: Text(l.account)),
      body: ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        children: [
          Text('${user.name}\n${user.mobile}', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppTokens.spaceS5),
          if (_error != null) ...[AppBanner(message: _error!, kind: 'error'), const SizedBox(height: AppTokens.spaceS3)],
          Text(l.changeMobile, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppTokens.spaceS2),
          if (!_changeOtpSent) ...[
            AppTextField(label: l.newMobile, controller: _newMobile, keyboardType: TextInputType.phone),
            AppButton(
              label: l.sendOtp,
              variant: AppButtonVariant.compact,
              loading: _busy,
              onPressed: () => _run(() async {
                if (!isValidIndianMobile(_newMobile.text)) throw ApiException(400, l.invalidMobile);
                await api.post('/account/change-mobile/start', {'newMobile': _newMobile.text});
                setState(() => _changeOtpSent = true);
              }),
            ),
          ] else ...[
            Text(l.otpSentTo(_newMobile.text)),
            const SizedBox(height: AppTokens.spaceS3),
            OtpInput(onCompleted: (v) => _changeOtp = v, onChanged: (v) => _changeOtp = v),
            const SizedBox(height: AppTokens.spaceS3),
            AppButton(
              label: l.changeNumber,
              loading: _busy,
              onPressed: () => _run(() async {
                await api.post('/account/change-mobile/confirm', {'newMobile': _newMobile.text, 'otp': _changeOtp});
                await ref.read(authRepositoryProvider).restore();
                setState(() => _changeOtpSent = false);
                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.mobileChanged)));
              }),
            ),
          ],
          const Divider(height: AppTokens.spaceS7),
          Text(l.deleteAccount, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppTokens.spaceS2),
          Text(l.deleteAccountIntro),
          const SizedBox(height: AppTokens.spaceS3),
          if (!_deleteOtpSent)
            AppButton(
              label: l.deleteAccount,
              variant: AppButtonVariant.danger,
              loading: _busy,
              onPressed: () => _run(() async {
                await api.post('/auth/otp/send', {'mobile': user.mobile, 'purpose': 'delete_account'});
                setState(() => _deleteOtpSent = true);
              }),
            )
          else ...[
            OtpInput(onCompleted: (v) => _deleteOtp = v, onChanged: (v) => _deleteOtp = v),
            const SizedBox(height: AppTokens.spaceS3),
            AppButton(
              label: l.deleteAccount,
              variant: AppButtonVariant.danger,
              loading: _busy,
              onPressed: () => _run(() async {
                await api.post('/account/delete', {'otp': _deleteOtp});
                await ref.read(sessionProvider.notifier).end(l.accountDeleted);
              }),
            ),
          ],
          const SizedBox(height: AppTokens.spaceS6),
          AppButton(label: l.logout, variant: AppButtonVariant.secondary, onPressed: () => logoutStudent(ref)),
        ],
      ),
    );
  }
}
