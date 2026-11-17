import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/viewModels/login_viewmodel.dart';
import '../../widgets/app_widgets.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _mobile = TextEditingController();
  String _otp = '';

  @override
  void dispose() {
    _mobile.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final state = ref.watch(loginViewModelProvider);
    final vm = ref.read(loginViewModelProvider.notifier);
    final session = ref.watch(sessionProvider);
    final error = state.error == 'invalidMobile' ? l.invalidMobile : state.error;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppTokens.spaceS4),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spaceS5),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(l.loginTitle, style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: AppTokens.spaceS2),
                      Text(l.loginIntro, style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: AppTokens.spaceS5),
                      if (session.endedMessage != null && state.step == LoginStep.mobile) ...[
                        AppBanner(message: session.endedMessage!, kind: 'warning'),
                        const SizedBox(height: AppTokens.spaceS4),
                      ],
                      if (state.step == LoginStep.mobile) ...[
                        AppTextField(
                          label: l.mobileNumber,
                          controller: _mobile,
                          keyboardType: TextInputType.phone,
                          hint: l.mobileHint,
                          errorText: error,
                          requiredField: true,
                        ),
                        AppButton(label: l.sendOtp, loading: state.loading, expand: true, onPressed: () => vm.sendOtp(_mobile.text)),
                        const SizedBox(height: AppTokens.spaceS3),
                        TextButton(onPressed: () => context.push('/register'), child: Text(l.pNewHere)),
                        TextButton(onPressed: () => context.push('/courses'), child: Text(l.sBrowse)),
                      ] else ...[
                        Text(l.otpSentTo(state.mobile)),
                        TextButton(onPressed: vm.changeNumber, child: Text(l.changeNumber)),
                        const SizedBox(height: AppTokens.spaceS3),
                        Center(child: OtpInput(onCompleted: (v) => setState(() => _otp = v), onChanged: (v) => setState(() => _otp = v))),
                        const SizedBox(height: AppTokens.spaceS4),
                        if (error != null) ...[
                          AppBanner(message: error, kind: 'error'),
                          const SizedBox(height: AppTokens.spaceS3),
                        ],
                        AppButton(
                          label: l.verifyLogin,
                          loading: state.loading,
                          expand: true,
                          onPressed: _otp.length == 6 ? () => vm.verify(_otp) : null,
                        ),
                        const SizedBox(height: AppTokens.spaceS3),
                        state.resendIn > 0
                            ? Text(l.resendIn(state.resendIn), textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall)
                            : TextButton(onPressed: vm.resend, child: Text(l.resendOtp)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
