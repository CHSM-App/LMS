import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:lms_app/core/offline/offline_ports.dart';

class MemoryDownloadDao implements DownloadDao {
  final rows = <int, DownloadRecord>{};
  final progress = <int, OfflineProgress>{};

  @override
  Future<List<DownloadRecord>> all() async => rows.values.toList();
  @override
  Future<DownloadRecord?> get(int contentId) async => rows[contentId];
  @override
  Future<void> upsert(DownloadRecord r) async => rows[r.contentId] = r;
  @override
  Future<void> delete(int contentId) async => rows.remove(contentId);
  @override
  Future<void> clear() async => rows.clear();

  @override
  Future<void> putProgress(OfflineProgress p) async => progress[p.contentId] = p;
  @override
  Future<List<OfflineProgress>> pendingProgress() async => progress.values.toList();
  @override
  Future<void> removeProgress(List<OfflineProgress> sent) async {
    for (final p in sent) {
      if (identical(progress[p.contentId], p)) progress.remove(p.contentId);
    }
  }
}

class MemoryKeyVault implements KeyVault {
  final keys = <String, String>{};
  @override
  Future<void> put(String keyId, String key) async => keys[keyId] = key;
  @override
  Future<String?> get(String keyId) async => keys[keyId];
  @override
  Future<void> delete(String keyId) async => keys.remove(keyId);
  @override
  Future<void> clear() async => keys.clear();
}

class FakeNetwork implements NetworkInfo {
  FakeNetwork({this.wifi = true, this.online = true});
  bool wifi;
  bool online;
  final _changes = StreamController<void>.broadcast();
  @override
  Future<bool> isWifi() async => wifi;
  @override
  Future<bool> isOnline() async => online;
  @override
  Stream<void> get changes => _changes.stream;
  void set({bool? wifi, bool? online}) {
    this.wifi = wifi ?? this.wifi;
    this.online = online ?? this.online;
    _changes.add(null);
  }
}

class FakeStorage implements StorageInfo {
  FakeStorage(this.free);
  int? free;
  @override
  Future<int?> freeBytes() async => free;
}

/// Writes [bytes] in [chunks] steps; can be paused between chunks via [CancelSignal].
class FakeDownloader implements Downloader {
  FakeDownloader(this.bytes, {this.chunks = 4});
  final Uint8List bytes;
  final int chunks;
  final requests = <({String url, int from})>[];
  Completer<void>? gate; // when set, the download waits here after the first chunk

  @override
  Future<void> fetch(String url, File to, {required void Function(int received, int total) onProgress, required CancelSignal cancel}) async {
    final from = to.existsSync() ? to.lengthSync() : 0;
    requests.add((url: url, from: from));
    final sink = to.openWrite(mode: FileMode.append);
    final step = (bytes.length / chunks).ceil();
    try {
      for (var i = from; i < bytes.length; i += step) {
        if (cancel.cancelled) throw const DownloadCancelled();
        final end = (i + step).clamp(0, bytes.length);
        sink.add(bytes.sublist(i, end));
        await sink.flush();
        onProgress(end, bytes.length);
        if (gate != null && end < bytes.length) {
          await gate!.future;
          gate = null;
        }
      }
    } finally {
      await sink.close();
    }
  }
}

Uint8List sampleBytes(int n) => Uint8List.fromList(List.generate(n, (i) => (i * 31 + 7) & 0xff));
