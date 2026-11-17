import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/offline/encrypted_store.dart';
import '../../core/offline/license_guard.dart';
import '../../core/offline/offline_ports.dart';
import '../../data/models/student_models.dart';
import '../../data/repositories/student_repository.dart';

enum DownloadStatus { queued, waitingWifi, downloading, paused, completed, failed }

enum DownloadMessageCode { waitingWifi, notEnoughSpace, deviceLimit, failed }

@immutable
class DownloadMessage {
  const DownloadMessage(this.code, {this.mb, this.text});
  final DownloadMessageCode code;
  final int? mb; // notEnoughSpace: how many MB to free
  final String? text; // server message for other failures

  @override
  bool operator ==(Object other) => other is DownloadMessage && other.code == code && other.mb == mb && other.text == text;
  @override
  int get hashCode => Object.hash(code, mb, text);
  @override
  String toString() => 'DownloadMessage($code, mb: $mb, text: $text)';
}

@immutable
class DownloadItem {
  const DownloadItem({required this.contentId, required this.courseId, required this.courseTitle, required this.title, required this.status, this.percent = 0, this.sizeBytes, this.licenseExpiresAt});
  final int contentId;
  final int courseId;
  final String courseTitle;
  final String title;
  final DownloadStatus status;
  final int percent;
  final int? sizeBytes;
  final DateTime? licenseExpiresAt;

  DownloadItem copyWith({DownloadStatus? status, int? percent, int? sizeBytes, DateTime? licenseExpiresAt}) => DownloadItem(
        contentId: contentId,
        courseId: courseId,
        courseTitle: courseTitle,
        title: title,
        status: status ?? this.status,
        percent: percent ?? this.percent,
        sizeBytes: sizeBytes ?? this.sizeBytes,
        licenseExpiresAt: licenseExpiresAt ?? this.licenseExpiresAt,
      );

  factory DownloadItem.fromRecord(DownloadRecord r) => DownloadItem(
        contentId: r.contentId,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        title: r.title,
        status: DownloadStatus.completed,
        percent: 100,
        sizeBytes: r.sizeBytes,
        licenseExpiresAt: r.licenseExpiresAt,
      );
}

@immutable
class DownloadsState {
  const DownloadsState({this.items = const {}, this.wifiOnly = false, this.message});
  final Map<int, DownloadItem> items;
  final bool wifiOnly;
  final DownloadMessage? message;

  int get storedBytes => items.values.where((i) => i.status == DownloadStatus.completed).fold(0, (a, i) => a + (i.sizeBytes ?? 0));
}

typedef Removed = ({String title, String reason});

/// Offline video downloads (DECISIONS.md "Offline video download rules"). Files are downloaded to a
/// temp file, encrypted into app support storage and the temp file deleted at once. No share/export.
class DownloadViewModel extends StateNotifier<DownloadsState> {
  DownloadViewModel({
    required this.repo,
    required this.dao,
    required this.vault,
    required this.network,
    required this.storage,
    required this.downloader,
    required this.deviceId,
    required this.offlineDir,
    required this.tempDir,
    this.saveWifiOnly,
    DateTime Function()? now,
  })  : _now = now ?? DateTime.now,
        guard = LicenseGuard(dao: dao, vault: vault),
        super(const DownloadsState()) {
    _netSub = network.changes.listen((_) => _onNetworkChange());
  }

  final StudentRepository repo;
  final DownloadDao dao;
  final KeyVault vault;
  final NetworkInfo network;
  final StorageInfo storage;
  final Downloader downloader;
  final Future<String> Function() deviceId;
  final Future<Directory> Function() offlineDir;
  final Future<Directory> Function() tempDir;
  final Future<void> Function(bool)? saveWifiOnly;
  final LicenseGuard guard;
  final DateTime Function() _now;

  static const reserveBytes = 200 * 1024 * 1024;
  static const _mb = 1024 * 1024;

  late final StreamSubscription<void> _netSub;
  final _cancels = <int, CancelSignal>{};
  final _active = <Future<void>>{};
  bool _deviceRegistered = false;

  /// Loads downloads saved on this device.
  Future<void> load({bool wifiOnly = false}) async {
    final rows = await dao.all();
    state = DownloadsState(items: {for (final r in rows) r.contentId: DownloadItem.fromRecord(r)}, wifiOnly: wifiOnly);
  }

  Future<void> setWifiOnly(bool v) async {
    state = DownloadsState(items: state.items, wifiOnly: v, message: state.message);
    await saveWifiOnly?.call(v);
  }

  void clearMessage() => state = DownloadsState(items: state.items, wifiOnly: state.wifiOnly);

  void _put(DownloadItem item, {DownloadMessage? message, bool keepMessage = true}) {
    if (!mounted) return;
    state = DownloadsState(items: {...state.items, item.contentId: item}, wifiOnly: state.wifiOnly, message: message ?? (keepMessage ? state.message : null));
  }

  Future<void> download({required int contentId, required int courseId, required String courseTitle, required String title}) {
    final existing = state.items[contentId];
    if (existing != null && (existing.status == DownloadStatus.downloading || existing.status == DownloadStatus.completed)) return Future.value();
    _put(DownloadItem(contentId: contentId, courseId: courseId, courseTitle: courseTitle, title: title, status: DownloadStatus.queued), keepMessage: false);
    return _track(_start(contentId));
  }

  void pause(int contentId) {
    _cancels[contentId]?.cancel();
    final item = state.items[contentId];
    if (item != null && item.status != DownloadStatus.completed && item.status != DownloadStatus.downloading) {
      _put(item.copyWith(status: DownloadStatus.paused));
    }
  }

  Future<void> resume(int contentId) {
    final item = state.items[contentId];
    if (item == null || item.status == DownloadStatus.completed || item.status == DownloadStatus.downloading) return Future.value();
    _put(item.copyWith(status: DownloadStatus.queued), keepMessage: false);
    return _track(_start(contentId));
  }

  /// Completes when no download is running.
  Future<void> idle() async {
    while (_active.isNotEmpty) {
      await Future.wait(_active.toList());
    }
  }

  Future<void> _track(Future<void> f) {
    _active.add(f);
    return f.whenComplete(() => _active.remove(f));
  }

  void _onNetworkChange() async {
    if (!mounted || !state.wifiOnly) return;
    final waiting = state.items.values.where((i) => i.status == DownloadStatus.waitingWifi).toList();
    if (waiting.isEmpty || !await network.isWifi()) return;
    for (final i in waiting) {
      _track(_start(i.contentId));
    }
  }

  void _fail(DownloadItem item, DownloadMessage message) => _put(item.copyWith(status: DownloadStatus.failed), message: message);

  Future<void> _start(int contentId) async {
    var item = state.items[contentId]!;
    if (state.wifiOnly && !await network.isWifi()) {
      _put(item.copyWith(status: DownloadStatus.waitingWifi), message: const DownloadMessage(DownloadMessageCode.waitingWifi));
      return;
    }

    final DownloadTicket ticket;
    final String device;
    try {
      device = await deviceId();
      if (!_deviceRegistered) {
        await repo.registerDevice(device, Platform.operatingSystem, Platform.isIOS ? 'ios' : 'android');
        _deviceRegistered = true;
      }
      ticket = await repo.issueDownload(contentId, device); // a fresh signed URL on every (re)start
    } on ApiException catch (e) {
      _fail(item, e.code == 'DEVICE_LIMIT' ? DownloadMessage(DownloadMessageCode.deviceLimit, text: e.message) : DownloadMessage(DownloadMessageCode.failed, text: e.message));
      return;
    }

    final size = ticket.sizeBytes ?? 0;
    final free = await storage.freeBytes();
    if (free != null && free < size + reserveBytes) {
      _fail(item.copyWith(sizeBytes: size), DownloadMessage(DownloadMessageCode.notEnoughSpace, mb: ((size + reserveBytes - free) / _mb).ceil()));
      return;
    }

    final tmpDir = await tempDir();
    await tmpDir.create(recursive: true);
    final temp = File('${tmpDir.path}${Platform.pathSeparator}$contentId.part');
    final cancel = _cancels[contentId] = CancelSignal();
    item = item.copyWith(status: DownloadStatus.downloading, sizeBytes: size);
    _put(item);
    try {
      await downloader.fetch(ticket.downloadUrl, temp, cancel: cancel, onProgress: (received, total) {
        final t = total > 0 ? total : max(size, 1);
        _put(state.items[contentId]!.copyWith(percent: min(99, received * 100 ~/ t)));
      });
    } on DownloadCancelled {
      _put(state.items[contentId]!.copyWith(status: DownloadStatus.paused));
      return;
    } catch (_) {
      _fail(state.items[contentId]!, const DownloadMessage(DownloadMessageCode.failed));
      return;
    } finally {
      _cancels.remove(contentId);
    }
    if (cancel.cancelled) {
      _put(state.items[contentId]!.copyWith(status: DownloadStatus.paused));
      return;
    }

    final dir = await offlineDir();
    final rnd = Random.secure();
    final name = List.generate(16, (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    final dest = File('${dir.path}${Platform.pathSeparator}$name.bin');
    try {
      await EncryptedStore.encryptFile(temp, dest, base64.decode(ticket.key));
    } finally {
      if (temp.existsSync()) await temp.delete();
    }
    final plainSize = EncryptedStore.plainLength(dest);
    await vault.put(ticket.keyId, ticket.key);
    final prev = await dao.get(contentId);
    if (prev != null) await guard.remove(prev);
    await dao.upsert(DownloadRecord(
      contentId: contentId,
      courseId: item.courseId,
      courseTitle: item.courseTitle,
      title: item.title,
      sizeBytes: plainSize,
      filePath: dest.path,
      keyId: ticket.keyId,
      licenseExpiresAt: ticket.licenseExpiresAt,
    ));
    _put(state.items[contentId]!.copyWith(status: DownloadStatus.completed, percent: 100, sizeBytes: plainSize, licenseExpiresAt: ticket.licenseExpiresAt));
  }

  Future<void> delete(int contentId) async {
    _cancels[contentId]?.cancel();
    final r = await dao.get(contentId);
    if (r != null) await guard.remove(r);
    final tmp = File('${(await tempDir()).path}${Platform.pathSeparator}$contentId.part');
    if (tmp.existsSync()) await tmp.delete();
    if (mounted) state = DownloadsState(items: {...state.items}..remove(contentId), wifiOnly: state.wifiOnly, message: state.message);
  }

  Future<void> deleteAll() async {
    for (final id in state.items.keys.toList()) {
      await delete(id);
    }
  }

  /// Renews every licence (app start + every time the device comes online). Revoked downloads are
  /// deleted with their keys; returns what was removed and why.
  Future<List<Removed>> renewAll() async {
    final rows = await dao.all();
    if (rows.isEmpty) return const [];
    final results = await repo.renew(await deviceId(), rows.map((r) => r.contentId).toList());
    final removed = <Removed>[];
    for (final res in results) {
      final r = rows.where((x) => x.contentId == res.contentId).firstOrNull;
      if (r == null) continue;
      if (res.revoked) {
        await guard.remove(r);
        removed.add((title: r.title, reason: res.revokedReason!));
        if (mounted) state = DownloadsState(items: {...state.items}..remove(r.contentId), wifiOnly: state.wifiOnly, message: state.message);
      } else if (res.licenseExpiresAt != null) {
        final updated = r.copyWith(licenseExpiresAt: res.licenseExpiresAt);
        await dao.upsert(updated);
        _put(DownloadItem.fromRecord(updated));
      }
    }
    return removed;
  }

  /// Logout: every offline file and key is deleted.
  Future<void> wipeAll() async {
    for (final c in _cancels.values) {
      c.cancel();
    }
    for (final r in await dao.all()) {
      final f = File(r.filePath);
      if (f.existsSync()) await f.delete();
    }
    for (final d in [await offlineDir(), await tempDir()]) {
      if (d.existsSync()) await d.delete(recursive: true);
    }
    await vault.clear();
    await dao.clear();
    if (mounted) state = DownloadsState(wifiOnly: state.wifiOnly);
  }

  DateTime now() => _now();

  @override
  void dispose() {
    _netSub.cancel();
    super.dispose();
  }
}

/// Wired in student_providers.dart with the platform implementations.
typedef DownloadViewModelProvider = StateNotifierProvider<DownloadViewModel, DownloadsState>;
