import '../../data/repositories/student_repository.dart';
import '../network/api_client.dart';
import 'offline_ports.dart';

/// Offline watch progress: one pending entry per lesson (latest position, completion kept),
/// sent with /student/progress/sync when online. Separate from the greyed-out exam outbox.
class OfflineProgressQueue {
  OfflineProgressQueue({required this.dao, required this.repo, required this.network, DateTime Function()? now}) : _now = now ?? DateTime.now;
  final DownloadDao dao;
  final StudentRepository repo;
  final NetworkInfo network;
  final DateTime Function() _now;
  Future<int>? _syncing;

  Future<void> record(int contentId, {int? positionSec, bool completed = false}) async {
    final pending = await dao.pendingProgress();
    OfflineProgress? prev;
    for (final p in pending) {
      if (p.contentId == contentId) prev = p;
    }
    await dao.putProgress(OfflineProgress(
      contentId: contentId,
      positionSec: positionSec ?? prev?.positionSec,
      completedAt: prev?.completedAt ?? (completed ? _now().toUtc() : null),
    ));
  }

  /// Sends everything pending. Concurrent calls share one send; returns how many entries this call sent.
  Future<int> sync() {
    if (_syncing != null) return Future.value(0);
    return _syncing = _send().whenComplete(() => _syncing = null);
  }

  Future<int> _send() async {
    if (!await network.isOnline()) return 0;
    final items = await dao.pendingProgress();
    if (items.isEmpty) return 0;
    try {
      await repo.syncProgress(items.map((p) => p.toJson()).toList());
    } on ApiException {
      return 0;
    }
    await dao.removeProgress(items);
    return items.length;
  }
}
