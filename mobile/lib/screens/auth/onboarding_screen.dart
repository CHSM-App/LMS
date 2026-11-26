import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/onboarding_provider.dart';
import '../../widgets/app_widgets.dart';

/// Three short slides on the very first launch. Skip or Get started goes to login and is remembered.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _page = PageController();
  int _index = 0;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  void _finish() {
    // Go on straight away; remembering it on disk happens in the background.
    ref.read(onboardingSeenProvider.notifier).state = true;
    saveOnboardingSeen();
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final slides = [
      (Icons.school_rounded, l.onbTitle1, l.onbBody1),
      (Icons.quiz_rounded, l.onbTitle2, l.onbBody2),
      (Icons.download_for_offline_rounded, l.onbTitle3, l.onbBody3),
    ];
    final last = _index == slides.length - 1;
    return Scaffold(
      backgroundColor: AppTokens.surface,
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.all(AppTokens.spaceS2),
                child: Opacity(opacity: last ? 0 : 1, child: IgnorePointer(ignoring: last, child: TextButton(onPressed: _finish, child: Text(l.onbSkip)))),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _page,
                itemCount: slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) {
                  final (icon, title, body) = slides[i];
                  return Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS5),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 440),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _Illustration(icon: icon),
                            const SizedBox(height: AppTokens.spaceS6),
                            Semantics(header: true, child: Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium)),
                            const SizedBox(height: AppTokens.spaceS3),
                            Text(body, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTokens.textSecondary)),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < slides.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: i == _index ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(color: i == _index ? AppTokens.actionPrimary : AppTokens.progressTrack, borderRadius: BorderRadius.circular(AppTokens.radiusPill)),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(AppTokens.spaceS5),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: AppButton(
                    label: last ? l.onbStart : l.onbNext,
                    expand: true,
                    onPressed: last ? _finish : () => _page.nextPage(duration: const Duration(milliseconds: 280), curve: Curves.easeOut),
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

/// The brand cover (navy to blue, orange ring) with a big icon, in place of a photo.
class _Illustration extends StatelessWidget {
  const _Illustration({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTokens.radiusLg + 8),
        child: Container(
          width: 240,
          height: 240,
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [AppTokens.brandNavy, AppTokens.brandNavy, AppTokens.brandBlue], stops: [0, 0.55, 1]),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Positioned(
                top: -50,
                right: -50,
                child: Container(width: 150, height: 150, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppTokens.brandOrange, width: 20))),
              ),
              Container(
                width: 112,
                height: 112,
                decoration: BoxDecoration(color: AppTokens.brandWhite.withValues(alpha: 0.12), shape: BoxShape.circle),
                child: Icon(icon, size: 60, color: AppTokens.brandWhite),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
