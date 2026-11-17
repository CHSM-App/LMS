import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import 'offline_ports.dart';

/// Real implementations of the offline ports. Files live only in app-private support storage —
/// never Downloads, the gallery or external storage.

Future<Directory> offlineDirectory() async => Directory('${(await getApplicationSupportDirectory()).path}${Platform.pathSeparator}offline');
Future<Directory> offlineTempDirectory() async => Directory('${(await getApplicationSupportDirectory()).path}${Platform.pathSeparator}offline_tmp');

class SqfliteDownloadDao implements DownloadDao {
  Database? _db;

  Future<Database> get _database async => _db ??= await openDatabase(
        '${(await getApplicationSupportDirectory()).path}${Platform.pathSeparator}offline.db',
        version: 1,
        onCreate: (db, _) async {
          await db.execute('''CREATE TABLE downloads (
            content_id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL, course_title TEXT NOT NULL, title TEXT NOT NULL,
            size_bytes INTEGER NOT NULL, file_path TEXT NOT NULL, key_id TEXT NOT NULL, license_expires_at TEXT NOT NULL)''');
          await db.execute('CREATE TABLE offline_progress (content_id INTEGER PRIMARY KEY, position_sec INTEGER, completed_at TEXT, seq INTEGER NOT NULL)');
        },
      );

  @override
  Future<List<DownloadRecord>> all() async => (await (await _database).query('downloads', orderBy: 'course_title, title')).map(DownloadRecord.fromRow).toList();

  @override
  Future<DownloadRecord?> get(int contentId) async {
    final rows = await (await _database).query('downloads', where: 'content_id = ?', whereArgs: [contentId]);
    return rows.isEmpty ? null : DownloadRecord.fromRow(rows.first);
  }

  @override
  Future<void> upsert(DownloadRecord r) async => (await _database).insert('downloads', r.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);

  @override
  Future<void> delete(int contentId) async => (await _database).delete('downloads', where: 'content_id = ?', whereArgs: [contentId]);

  @override
  Future<void> clear() async {
    final db = await _database;
    await db.delete('downloads');
    await db.delete('offline_progress');
  }

  int _seq = DateTime.now().microsecondsSinceEpoch;

  @override
  Future<void> putProgress(OfflineProgress p) async => (await _database).insert(
        'offline_progress',
        {'content_id': p.contentId, 'position_sec': p.positionSec, 'completed_at': p.completedAt?.toIso8601String(), 'seq': _seq++},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

  final _sentSeq = Expando<int>();

  @override
  Future<List<OfflineProgress>> pendingProgress() async {
    final rows = await (await _database).query('offline_progress');
    return rows.map((r) {
      final p = OfflineProgress(
        contentId: r['content_id']! as int,
        positionSec: r['position_sec'] as int?,
        completedAt: r['completed_at'] == null ? null : DateTime.parse(r['completed_at']! as String),
      );
      _sentSeq[p] = r['seq']! as int;
      return p;
    }).toList();
  }

  @override
  Future<void> removeProgress(List<OfflineProgress> sent) async {
    final db = await _database;
    for (final p in sent) {
      await db.delete('offline_progress', where: 'content_id = ? AND seq = ?', whereArgs: [p.contentId, _sentSeq[p]]);
    }
  }
}

class SecureKeyVault implements KeyVault {
  static const _prefix = 'dlkey:';
  final _storage = const FlutterSecureStorage();

  @override
  Future<void> put(String keyId, String key) => _storage.write(key: '$_prefix$keyId', value: key);
  @override
  Future<String?> get(String keyId) => _storage.read(key: '$_prefix$keyId');
  @override
  Future<void> delete(String keyId) => _storage.delete(key: '$_prefix$keyId');
  @override
  Future<void> clear() async {
    final all = await _storage.readAll();
    for (final k in all.keys.where((k) => k.startsWith(_prefix))) {
      await _storage.delete(key: k);
    }
  }
}

class ConnectivityNetworkInfo implements NetworkInfo {
  final _c = Connectivity();
  @override
  Future<bool> isWifi() async => (await _c.checkConnectivity()).contains(ConnectivityResult.wifi) || (await _c.checkConnectivity()).contains(ConnectivityResult.ethernet);
  @override
  Future<bool> isOnline() async => !(await _c.checkConnectivity()).every((r) => r == ConnectivityResult.none);
  @override
  Stream<void> get changes => _c.onConnectivityChanged.map((_) {});
}

/// Free space and screen protection come from a tiny platform channel (MainActivity.kt).
class DeviceChannel implements StorageInfo {
  static const _ch = MethodChannel('lms/device');

  @override
  Future<int?> freeBytes() async {
    try {
      return await _ch.invokeMethod<int>('freeBytes');
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }

  /// Android FLAG_SECURE: screenshots and screen recordings come out black while the player is open.
  static Future<void> setSecure(bool on) async {
    try {
      await _ch.invokeMethod<void>('setSecure', on);
    } on MissingPluginException {
      // iOS / tests: not available.
    } on PlatformException {
      // ignore
    }
  }
}

class DioDownloader implements Downloader {
  final _dio = Dio(BaseOptions(connectTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(minutes: 2)));

  @override
  Future<void> fetch(String url, File to, {required void Function(int received, int total) onProgress, required CancelSignal cancel}) async {
    final from = to.existsSync() ? await to.length() : 0;
    final token = CancelToken();
    final watch = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (cancel.cancelled && !token.isCancelled) token.cancel();
    });
    final sink = to.openWrite(mode: from > 0 ? FileMode.append : FileMode.write);
    try {
      final res = await _dio.get<ResponseBody>(
        url,
        cancelToken: token,
        options: Options(responseType: ResponseType.stream, headers: {if (from > 0) 'Range': 'bytes=$from-'}),
      );
      final partial = res.statusCode == 206;
      if (from > 0 && !partial) {
        // Server ignored Range: start over.
        await sink.close();
        await to.writeAsBytes(const []);
        return fetch(url, to, onProgress: onProgress, cancel: cancel);
      }
      final length = int.tryParse(res.headers.value(Headers.contentLengthHeader) ?? '') ?? 0;
      final total = (partial ? from : 0) + length;
      var received = from;
      await for (final chunk in res.data!.stream) {
        if (cancel.cancelled) throw const DownloadCancelled();
        sink.add(chunk);
        received += chunk.length;
        onProgress(received, max(total, received));
      }
    } on DioException catch (e) {
      if (CancelToken.isCancel(e) || cancel.cancelled) throw const DownloadCancelled();
      rethrow;
    } finally {
      watch.cancel();
      await sink.flush();
      await sink.close();
    }
  }
}

/// Stable per-install device id (6–64 letters/digits/dashes) kept in secure storage.
class DeviceIdentity {
  static const _key = 'device_id';
  static final _storage = const FlutterSecureStorage();
  static String? _cached;

  static Future<String> id() async {
    if (_cached != null) return _cached!;
    var v = await _storage.read(key: _key);
    if (v == null) {
      final rnd = Random.secure();
      v = List.generate(16, (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
      await _storage.write(key: _key, value: v);
    }
    return _cached = v;
  }
}
