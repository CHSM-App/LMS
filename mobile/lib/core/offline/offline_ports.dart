import 'dart:io';

import 'package:flutter/foundation.dart';

/// Offline video storage contracts. Real implementations live in offline_platform.dart;
/// tests use in-memory fakes.

@immutable
class DownloadRecord {
  const DownloadRecord({required this.contentId, required this.courseId, required this.courseTitle, required this.title, required this.sizeBytes, required this.filePath, required this.keyId, required this.licenseExpiresAt});
  final int contentId;
  final int courseId;
  final String courseTitle;
  final String title;
  final int sizeBytes;
  final String filePath;
  final String keyId;
  final DateTime licenseExpiresAt;

  DownloadRecord copyWith({DateTime? licenseExpiresAt}) => DownloadRecord(
        contentId: contentId,
        courseId: courseId,
        courseTitle: courseTitle,
        title: title,
        sizeBytes: sizeBytes,
        filePath: filePath,
        keyId: keyId,
        licenseExpiresAt: licenseExpiresAt ?? this.licenseExpiresAt,
      );

  Map<String, Object?> toRow() => {
        'content_id': contentId,
        'course_id': courseId,
        'course_title': courseTitle,
        'title': title,
        'size_bytes': sizeBytes,
        'file_path': filePath,
        'key_id': keyId,
        'license_expires_at': licenseExpiresAt.toUtc().toIso8601String(),
      };

  factory DownloadRecord.fromRow(Map<String, Object?> r) => DownloadRecord(
        contentId: r['content_id']! as int,
        courseId: r['course_id']! as int,
        courseTitle: r['course_title']! as String,
        title: r['title']! as String,
        sizeBytes: r['size_bytes']! as int,
        filePath: r['file_path']! as String,
        keyId: r['key_id']! as String,
        licenseExpiresAt: DateTime.parse(r['license_expires_at']! as String),
      );
}

/// Watch position / completion recorded while offline, sent later via /student/progress/sync.
@immutable
class OfflineProgress {
  const OfflineProgress({required this.contentId, this.positionSec, this.completedAt});
  final int contentId;
  final int? positionSec;
  final DateTime? completedAt;

  Map<String, dynamic> toJson() => {'contentId': contentId, 'positionSec': positionSec, 'completedAt': completedAt?.toUtc().toIso8601String()};
}

abstract class DownloadDao {
  Future<List<DownloadRecord>> all();
  Future<DownloadRecord?> get(int contentId);
  Future<void> upsert(DownloadRecord r);
  Future<void> delete(int contentId);
  Future<void> clear();

  Future<void> putProgress(OfflineProgress p);
  Future<List<OfflineProgress>> pendingProgress();

  /// Removes exactly the entries that were sent; an entry recorded after the send stays queued.
  Future<void> removeProgress(List<OfflineProgress> sent);
}

/// Per-download AES keys, kept in the platform keystore (flutter_secure_storage).
abstract class KeyVault {
  Future<void> put(String keyId, String key);
  Future<String?> get(String keyId);
  Future<void> delete(String keyId);
  Future<void> clear();
}

abstract class NetworkInfo {
  Future<bool> isWifi();
  Future<bool> isOnline();
  Stream<void> get changes;
}

abstract class StorageInfo {
  /// Free bytes on the app's storage volume, or null when the platform can't tell.
  Future<int?> freeBytes();
}

class CancelSignal {
  bool cancelled = false;
  void cancel() => cancelled = true;
}

class DownloadCancelled implements Exception {
  const DownloadCancelled();
}

abstract class Downloader {
  /// Appends to [to] from its current length (HTTP Range), reporting progress; throws [DownloadCancelled].
  Future<void> fetch(String url, File to, {required void Function(int received, int total) onProgress, required CancelSignal cancel});
}
