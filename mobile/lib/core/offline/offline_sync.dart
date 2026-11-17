import 'dart:async';

import 'offline_ports.dart';

typedef RemovedDownload = ({String title, String reason});

/// Keeps offline videos honest: on app start and every time the phone comes back online it renews
/// licences (deleting revoked videos and keys) and sends queued offline watch progress.
class OfflineSync {
  OfflineSync({required this.network, required this.renew, required this.syncProgress, required this.onRemoved});

  final NetworkInfo network;
  final Future<List<RemovedDownload>> Function() renew;
  final Future<int> Function() syncProgress;
  final void Function(List<RemovedDownload>) onRemoved;

  StreamSubscription<void>? _sub;
  Future<void>? _running;
  bool _wasOnline = false;
  bool _started = false;

  Future<void> start() async {
    if (_started) return;
    _started = true;
    _sub = network.changes.listen((_) => _onChange());
    await runNow();
  }

  Future<void> _onChange() async {
    final online = await network.isOnline();
    final cameBack = online && !_wasOnline;
    _wasOnline = online;
    if (cameBack) await runNow();
  }

  /// One run at a time; a call during a run waits for that run.
  Future<void> runNow() => _running ??= _run().whenComplete(() => _running = null);

  Future<void> _run() async {
    _wasOnline = await network.isOnline();
    if (!_wasOnline) return;
    try {
      final removed = await renew();
      if (removed.isNotEmpty) onRemoved(removed);
    } catch (_) {
      // Offline mid-run or server error: try again on the next online event.
      _wasOnline = false;
    }
    try {
      await syncProgress();
    } catch (_) {
      // Kept in the queue for next time.
    }
  }

  Future<void> dispose() async => _sub?.cancel();
}
