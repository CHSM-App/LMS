import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_tokens.g.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/providers/student_providers.dart';
import '../../../widgets/app_widgets.dart';
import '../../../widgets/skeleton.dart';

/// Spinner / error-with-retry / data for a FutureProvider value.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.value, required this.builder, this.onRetry});
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return value.when(
      data: builder,
      loading: () => const ListSkeleton(),
      error: (e, _) => EmptyState(title: e.toString(), actionLabel: onRetry == null ? null : l.tryAgain, onAction: onRetry),
    );
  }
}

String formatDate(BuildContext context, DateTime d) => DateFormat.yMMMd(Localizations.localeOf(context).languageCode).format(d.toLocal());
String formatDateTime(BuildContext context, DateTime d) => DateFormat.yMMMd(Localizations.localeOf(context).languageCode).add_jm().format(d.toLocal());

String formatBytes(int bytes) {
  const mb = 1024 * 1024;
  if (bytes >= 1024 * mb) return '${(bytes / (1024 * mb)).toStringAsFixed(1)} GB';
  return '${(bytes / mb).round()} MB';
}

/// Opens Meet links, notes and outside videos in the browser / Meet app.
Future<void> openExternal(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

/// Opens a URL outside the app; overridden in tests.
final externalOpenerProvider = Provider<Future<void> Function(String url)>((ref) => openExternal);

/// Join: marks the student present (automatic attendance), then opens Meet.
/// Meet opens even if marking fails (e.g. a network drop), so the student is never blocked.
Future<void> joinLiveClass(WidgetRef ref, int? liveClassId, String meetLink) async {
  if (liveClassId != null) {
    try {
      await ref.read(studentRepositoryProvider).joinLiveClass(liveClassId);
    } catch (_) {}
  }
  await ref.read(externalOpenerProvider)(meetLink);
}

/// Notes open in an in-app browser tab (no download/share controls of ours).
Future<void> openInApp(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.inAppBrowserView);

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: AppTokens.spaceS6, bottom: AppTokens.spaceS3),
        child: Semantics(
          header: true,
          child: Text(text, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppTokens.heading, fontWeight: FontWeight.w800, fontSize: 17)),
        ),
      );
}

/// Join shows only when [meetLink] is set, which the API does only in the join window
/// (10 min before start until the end). Before that the tile says when Join opens.
class LiveClassTile extends ConsumerWidget {
  const LiveClassTile({super.key, this.liveClassId, required this.topic, required this.subtitle, required this.meetLink, this.waitingForLink = false});
  final int? liveClassId;
  final String topic;
  final String subtitle;
  final String? meetLink;

  /// Class time, but the teacher has not added the Meet link yet.
  final bool waitingForLink;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final link = meetLink;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spaceS3),
        child: Row(
          children: [
            const CoverBadge(size: 48, icon: Icons.videocam_rounded),
            const SizedBox(width: AppTokens.spaceS3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(topic, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: AppTokens.textBase, fontWeight: FontWeight.w800, color: AppTokens.heading, height: 1.25)),
                  const SizedBox(height: 2),
                  Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: AppTokens.textSm, color: AppTokens.textSecondary)),
                ],
              ),
            ),
            const SizedBox(width: AppTokens.spaceS2),
            if (link != null)
              AppButton(label: l.join, variant: AppButtonVariant.compact, onPressed: () => joinLiveClass(ref, liveClassId, link))
            else
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 96),
                child: Text(waitingForLink ? l.sLiveWaitingForLink : l.sLiveJoinSoon, textAlign: TextAlign.end, style: const TextStyle(fontSize: AppTokens.textXs, color: AppTokens.textSecondary)),
              ),
          ],
        ),
      ),
    );
  }
}

/// Photo of a worked solution (e.g. a maths sum solved on paper), shown with the explanation.
/// The whole photo is kept (no cropping); if it fails to load, nothing is shown.
class SolutionImage extends StatelessWidget {
  const SolutionImage({super.key, required this.url, required this.label});
  final String url;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppTokens.spaceS2),
      child: Semantics(
        label: label,
        image: true,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 480),
            child: Image.network(url, fit: BoxFit.contain, excludeFromSemantics: true, errorBuilder: (_, _, _) => const SizedBox.shrink()),
          ),
        ),
      ),
    );
  }
}
