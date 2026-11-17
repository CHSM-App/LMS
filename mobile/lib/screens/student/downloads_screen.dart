import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
import '../../presentation/viewModels/download_viewmodel.dart';
import '../../widgets/app_widgets.dart';
import 'widgets/common.dart';
import 'widgets/lesson_row.dart';

String reasonText(AppLocalizations l, String reason) => switch (reason) {
      'subscription_ended' => l.sReasonSubscription,
      'teacher_inactive' => l.sReasonTeacher,
      'access_paused' => l.sReasonPaused,
      'device_removed' => l.sReasonDevice,
      _ => l.sReasonOther,
    };

String downloadMessageText(AppLocalizations l, DownloadMessage m) => switch (m.code) {
      DownloadMessageCode.waitingWifi => l.sWaitingWifi,
      DownloadMessageCode.notEnoughSpace => l.sNotEnoughSpace('${m.mb}'),
      DownloadMessageCode.deviceLimit => l.sDeviceLimit,
      DownloadMessageCode.failed => m.text ?? l.sDownloadFailed,
    };

/// Profile → Downloads: offline videos grouped by course, storage used, Wi-Fi only, devices.
/// Deliberately has no share, export or open-with action.
class DownloadsScreen extends ConsumerWidget {
  const DownloadsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final s = ref.watch(downloadsProvider);
    final vm = ref.read(downloadsProvider.notifier);
    final removed = ref.watch(removedDownloadsProvider);
    final byCourse = <String, List<DownloadItem>>{};
    for (final i in s.items.values) {
      byCourse.putIfAbsent(i.courseTitle, () => []).add(i);
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.sDownloads)),
      body: ListView(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        children: [
          for (final r in removed) Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS2), child: AppBanner(kind: 'warning', message: l.sRemoved(r.title, reasonText(l, r.reason)))),
          if (s.message != null) Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS2), child: AppBanner(kind: 'warning', message: downloadMessageText(l, s.message!))),
          Text(l.sStorageUsed(formatBytes(s.storedBytes)), style: const TextStyle(fontWeight: FontWeight.w700)),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: s.wifiOnly, title: Text(l.sWifiOnly), onChanged: vm.setWifiOnly),
          if (s.items.isEmpty) EmptyState(title: l.sNoDownloads),
          for (final entry in byCourse.entries) ...[
            SectionTitle(entry.key),
            for (final i in entry.value)
              Card(
                child: ListTile(
                  title: Text(i.title),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DownloadChip(item: i),
                      if (i.sizeBytes != null && i.sizeBytes! > 0) Text(formatBytes(i.sizeBytes!), style: const TextStyle(fontSize: AppTokens.textSm)),
                      if (i.status == DownloadStatus.completed && i.licenseExpiresAt != null)
                        Text(l.sExpires(formatDate(context, i.licenseExpiresAt!)), style: const TextStyle(fontSize: AppTokens.textSm)),
                    ],
                  ),
                  onTap: i.status == DownloadStatus.completed ? () => context.push('/student/offline/${i.contentId}') : null,
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (i.status == DownloadStatus.downloading) IconButton(tooltip: l.sPause, icon: const Icon(Icons.pause), onPressed: () => vm.pause(i.contentId)),
                      if (i.status == DownloadStatus.paused || i.status == DownloadStatus.failed || i.status == DownloadStatus.waitingWifi)
                        IconButton(tooltip: l.sResume, icon: const Icon(Icons.play_arrow), onPressed: () => vm.resume(i.contentId)),
                      IconButton(tooltip: l.sDelete, icon: const Icon(Icons.delete_outline), onPressed: () => vm.delete(i.contentId)),
                    ],
                  ),
                ),
              ),
          ],
          if (s.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppTokens.spaceS4),
              child: AppButton(label: l.sDeleteAll, variant: AppButtonVariant.danger, onPressed: vm.deleteAll),
            ),
          SectionTitle(l.sDevices),
          AsyncView<List<RegisteredDevice>>(
            value: ref.watch(devicesProvider),
            onRetry: () => ref.invalidate(devicesProvider),
            builder: (devices) => Column(
              children: [
                for (final d in devices)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.phone_android),
                      title: Text(d.deviceName ?? d.platform ?? d.deviceId),
                      subtitle: Text('${d.downloads}'),
                      trailing: TextButton(
                        onPressed: () async {
                          await ref.read(studentRepositoryProvider).removeDevice(d.deviceId);
                          ref.invalidate(devicesProvider);
                        },
                        child: Text(l.sRemove),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
