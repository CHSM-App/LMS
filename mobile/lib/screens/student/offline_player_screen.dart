import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/offline/decrypt_stream_server.dart';
import '../../core/offline/license_guard.dart';
import '../../core/offline/offline_platform.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import 'widgets/video_view.dart';

/// Plays a downloaded video with no internet: checks the licence, decrypts through a loopback
/// stream and blocks screenshots/recording (Android FLAG_SECURE) while open. Progress is queued.
class OfflinePlayerScreen extends ConsumerStatefulWidget {
  const OfflinePlayerScreen({super.key, required this.contentId});
  final int contentId;

  @override
  ConsumerState<OfflinePlayerScreen> createState() => _OfflinePlayerScreenState();
}

class _OfflinePlayerScreenState extends ConsumerState<OfflinePlayerScreen> {
  LicenseCheck? _check;
  DecryptStreamServer? _server;

  @override
  void initState() {
    super.initState();
    _open();
  }

  Future<void> _open() async {
    final check = await ref.read(licenseGuardProvider).open(widget.contentId, now: DateTime.now().toUtc());
    if (check is LicenseOk) {
      await DeviceChannel.setSecure(true);
      final server = await DecryptStreamServer.start(File(check.record.filePath), check.key);
      if (!mounted) {
        await server.close();
        return;
      }
      _server = server;
    }
    if (mounted) setState(() => _check = check);
  }


  @override
  void dispose() {
    _server?.close();
    DeviceChannel.setSecure(false);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final c = _check;
    final queue = ref.read(progressQueueProvider);
    return Scaffold(
      appBar: AppBar(title: Text(c is LicenseOk ? c.record.title : (c is LicenseExpired ? c.record.title : ''))),
      body: Padding(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        child: switch (c) {
          null => const Center(child: CircularProgressIndicator()),
          LicenseOk() when _server != null => VideoView(
              url: _server!.url,
              onPosition: (sec) => queue.record(widget.contentId, positionSec: sec),
              onEnded: () => queue.record(widget.contentId, completed: true),
            ),
          LicenseExpired() => AppBanner(kind: 'warning', message: l.sLicenseExpired),
          _ => EmptyState(title: l.sNoDownloads),
        },
      ),
    );
  }
}

