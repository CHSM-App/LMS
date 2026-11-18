import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_tokens.g.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../widgets/app_widgets.dart';

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
      loading: () => const Center(child: Padding(padding: EdgeInsets.all(AppTokens.spaceS6), child: CircularProgressIndicator())),
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

/// Notes open in an in-app browser tab (no download/share controls of ours).
Future<void> openInApp(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.inAppBrowserView);

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: AppTokens.spaceS5, bottom: AppTokens.spaceS2),
        child: Text(text, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppTokens.heading, fontWeight: FontWeight.w800)),
      );
}

/// Join shows only when [meetLink] is set, which the API does only in the join window
/// (10 min before start until the end). Before that the tile says when Join opens.
class LiveClassTile extends StatelessWidget {
  const LiveClassTile({super.key, required this.topic, required this.subtitle, required this.meetLink});
  final String topic;
  final String subtitle;
  final String? meetLink;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final link = meetLink;
    return Card(
      child: ListTile(
        title: Text(topic, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle),
        trailing: link != null
            ? TextButton(onPressed: () => openExternal(link), child: Text(l.join))
            : ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 120),
                child: Text(l.sLiveJoinSoon, textAlign: TextAlign.end, style: const TextStyle(color: AppTokens.textSecondary)),
              ),
      ),
    );
  }
}
