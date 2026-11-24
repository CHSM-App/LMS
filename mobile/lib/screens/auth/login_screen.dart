import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/locale_provider.dart';
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
    final onMobileStep = state.step == LoginStep.mobile;
    final text = Theme.of(context).textTheme;

    void verify(String code) {
      if (code.length == 6 && !state.loading) vm.verify(code);
    }

    final mobileStep = Column(
      key: const ValueKey('step-mobile'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (session.endedMessage != null) ...[
          AppBanner(message: session.endedMessage!, kind: 'warning'),
          const SizedBox(height: AppTokens.spaceS4),
        ],
        AppTextField(
          label: l.mobileNumber,
          controller: _mobile,
          keyboardType: TextInputType.phone,
          hint: l.mobileHint,
          errorText: error,
          requiredField: true,
          prefixText: '+91',
          autofocus: true,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(12)],
          onSubmitted: vm.sendOtp,
        ),
        AppButton(label: l.sendOtp, loading: state.loading, expand: true, onPressed: () => vm.sendOtp(_mobile.text)),
        const SizedBox(height: AppTokens.spaceS4),
        const Divider(),
        const SizedBox(height: AppTokens.spaceS2),
        AppButton(label: l.pNewHere, variant: AppButtonVariant.secondary, expand: true, onPressed: () => context.push('/register')),
        const SizedBox(height: AppTokens.spaceS2),
        TextButton(onPressed: () => context.push('/courses'), child: Text(l.sBrowse)),
      ],
    );

    final otpStep = Column(
      key: const ValueKey('step-otp'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.otpSentTo(state.mobile)),
        TextButton(onPressed: vm.changeNumber, child: Text(l.changeNumber)),
        const SizedBox(height: AppTokens.spaceS3),
        // Six digits verify on their own; the button stays for anyone who prefers to tap.
        Center(
          child: OtpInput(
            onCompleted: (v) {
              setState(() => _otp = v);
              verify(v);
            },
            onChanged: (v) => setState(() => _otp = v),
          ),
        ),
        const SizedBox(height: AppTokens.spaceS4),
        if (error != null) ...[
          AppBanner(message: error, kind: 'error'),
          const SizedBox(height: AppTokens.spaceS3),
        ],
        AppButton(label: l.verifyLogin, loading: state.loading, expand: true, onPressed: _otp.length == 6 ? () => vm.verify(_otp) : null),
        const SizedBox(height: AppTokens.spaceS3),
        state.resendIn > 0
            ? Text(l.resendIn(state.resendIn), textAlign: TextAlign.center, style: text.bodySmall)
            : TextButton(onPressed: vm.resend, child: Text(l.resendOtp)),
      ],
    );

    // Same idea as the web login, kept short for a phone: a navy welcome panel, then the white form.
    return Scaffold(
      backgroundColor: AppTokens.surface,
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              decoration: const BoxDecoration(
                color: AppTokens.brandNavy,
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(AppTokens.radiusLg + 8)),
              ),
              child: const SafeArea(bottom: false, child: _WelcomePanel()),
            ),
            SafeArea(
              top: false,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(AppTokens.spaceS5, AppTokens.spaceS5, AppTokens.spaceS5, AppTokens.spaceS5),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _StepPill(step: onMobileStep ? 1 : 2, label: onMobileStep ? l.loginStepMobile : l.loginStepVerify),
                        const SizedBox(height: AppTokens.spaceS3),
                        Text(l.loginTitle, style: text.headlineMedium),
                        const SizedBox(height: AppTokens.spaceS2),
                        Text(l.loginIntro, style: text.bodySmall),
                        const SizedBox(height: AppTokens.spaceS5),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          switchInCurve: Curves.easeOut,
                          transitionBuilder: (child, animation) => FadeTransition(
                            opacity: animation,
                            child: SlideTransition(
                              position: Tween<Offset>(begin: const Offset(0.06, 0), end: Offset.zero).animate(animation),
                              child: child,
                            ),
                          ),
                          child: onMobileStep ? mobileStep : otpStep,
                        ),
                        const SizedBox(height: AppTokens.spaceS4),
                        Text(l.loginTerms, textAlign: TextAlign.center, style: text.bodySmall),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Navy header: logo, app name, language choice and the welcome line. Short, so the keyboard still leaves room.
class _WelcomePanel extends ConsumerWidget {
  const _WelcomePanel();

  static const _languages = [('en', 'English'), ('mr', 'मराठी'), ('hi', 'हिंदी')];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final current = Localizations.localeOf(context).languageCode;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppTokens.spaceS5, AppTokens.spaceS4, AppTokens.spaceS5, AppTokens.spaceS5),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: AppTokens.actionPrimary, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
                    child: const Icon(Icons.school_rounded, color: AppTokens.actionPrimaryText, size: 24),
                  ),
                  const SizedBox(width: AppTokens.spaceS3),
                  Expanded(
                    child: Text(l.appName, style: const TextStyle(color: AppTokens.navText, fontSize: AppTokens.textMd, fontWeight: FontWeight.w800)),
                  ),
                  for (final (code, name) in _languages)
                    Padding(
                      padding: const EdgeInsets.only(left: AppTokens.spaceS1),
                      child: _LanguageChip(
                        label: name,
                        selected: code == current,
                        onTap: () => ref.read(localeProvider.notifier).set(Locale(code)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppTokens.spaceS5),
              Semantics(
                header: true,
                child: Text(
                  l.loginWelcome,
                  style: const TextStyle(color: AppTokens.navText, fontSize: AppTokens.textXl, fontWeight: FontWeight.w800, height: AppTokens.lineHeightHeading),
                ),
              ),
              const SizedBox(height: AppTokens.spaceS1),
              Text(l.appTagline, style: const TextStyle(color: AppTokens.navTextMuted, fontSize: AppTokens.textSm)),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageChip extends StatelessWidget {
  const _LanguageChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTokens.radiusPill),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppTokens.sizeTapTarget),
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS2, vertical: 4),
              decoration: BoxDecoration(
                color: selected ? AppTokens.brandWhite : null,
                borderRadius: BorderRadius.circular(AppTokens.radiusPill),
                border: Border.all(color: selected ? AppTokens.brandWhite : AppTokens.navTextMuted),
              ),
              child: Text(
                label,
                style: TextStyle(
                  color: selected ? AppTokens.brandNavy : AppTokens.navText,
                  fontSize: AppTokens.textXs,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Step 1 of 2 · Mobile number", as on the web.
class _StepPill extends StatelessWidget {
  const _StepPill({required this.step, required this.label});

  final int step;
  final String label;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS2, vertical: 2),
          decoration: BoxDecoration(color: AppTokens.accentSoft, borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
          child: Text(l.loginStep(step, 2), style: const TextStyle(color: AppTokens.text, fontSize: AppTokens.textSm, fontWeight: FontWeight.w600)),
        ),
        const SizedBox(width: AppTokens.spaceS2),
        Flexible(child: Text(label, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm))),
      ],
    );
  }
}
