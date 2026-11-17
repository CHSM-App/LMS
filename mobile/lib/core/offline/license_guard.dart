import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'offline_ports.dart';

sealed class LicenseCheck {
  const LicenseCheck();
}

class LicenseOk extends LicenseCheck {
  const LicenseOk(this.record, this.key);
  final DownloadRecord record;
  final Uint8List key;
}

/// "Connect to the internet to keep watching offline".
class LicenseExpired extends LicenseCheck {
  const LicenseExpired(this.record);
  final DownloadRecord record;
}

class LicenseMissing extends LicenseCheck {
  const LicenseMissing();
}

/// Gatekeeper for offline playback and for removing revoked downloads.
class LicenseGuard {
  LicenseGuard({required this.dao, required this.vault});
  final DownloadDao dao;
  final KeyVault vault;

  Future<LicenseCheck> open(int contentId, {required DateTime now}) async {
    final r = await dao.get(contentId);
    if (r == null || !File(r.filePath).existsSync()) return const LicenseMissing();
    if (!r.licenseExpiresAt.isAfter(now)) return LicenseExpired(r);
    final key = await vault.get(r.keyId);
    if (key == null) return const LicenseMissing();
    return LicenseOk(r, base64.decode(key));
  }

  /// Deletes the encrypted file, its key and its row.
  Future<void> remove(DownloadRecord r) async {
    final f = File(r.filePath);
    if (f.existsSync()) await f.delete();
    await vault.delete(r.keyId);
    await dao.delete(r.contentId);
  }
}
