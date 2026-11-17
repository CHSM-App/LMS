import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:pointycastle/export.dart';

/// Encrypted offline video files: AES-256-CTR so any byte range can be decrypted (seeking).
///
/// File layout: 64-byte header [ "LMSV1" magic(8) | nonce(16) | plain length uint64 BE(8) | zero padding ]
/// followed by the ciphertext. The key never touches disk next to the file (it lives in [KeyVault]).
abstract final class EncryptedStore {
  static const headerLength = 64;
  static const _magic = [0x4c, 0x4d, 0x53, 0x56, 0x31, 0, 0, 0];
  static const _chunk = 64 * 1024;

  /// Encrypts [src] into [dst] chunk by chunk. The caller deletes [src] afterwards.
  static Future<void> encryptFile(File src, File dst, Uint8List key) async {
    final rnd = Random.secure();
    final nonce = Uint8List.fromList(List.generate(16, (_) => rnd.nextInt(256)));
    final length = await src.length();
    final header = Uint8List(headerLength)
      ..setAll(0, _magic)
      ..setAll(8, nonce);
    ByteData.sublistView(header).setUint64(24, length);

    await dst.parent.create(recursive: true);
    final out = dst.openWrite();
    out.add(header);
    final ctr = _Ctr(key, nonce);
    var offset = 0;
    await for (final chunk in src.openRead()) {
      final data = Uint8List.fromList(chunk);
      ctr.xorAt(data, offset);
      offset += data.length;
      out.add(data);
    }
    await out.flush();
    await out.close();
  }

  static int plainLength(File f) {
    final raf = f.openSync();
    try {
      final h = raf.readSync(headerLength);
      return ByteData.sublistView(h).getUint64(24);
    } finally {
      raf.closeSync();
    }
  }

  /// Decrypted bytes [start, end) of the stored video.
  static Stream<Uint8List> openRead(File f, Uint8List key, [int start = 0, int? end]) async* {
    final raf = await f.open();
    try {
      final h = await raf.read(headerLength);
      for (var i = 0; i < _magic.length; i++) {
        if (h[i] != _magic[i]) throw const FormatException('Not an offline video file');
      }
      final nonce = Uint8List.fromList(h.sublist(8, 24));
      final total = ByteData.sublistView(h).getUint64(24);
      final stop = min(end ?? total, total);
      final ctr = _Ctr(key, nonce);
      var pos = start;
      await raf.setPosition(headerLength + start);
      while (pos < stop) {
        final data = await raf.read(min(_chunk, stop - pos));
        if (data.isEmpty) break;
        ctr.xorAt(data, pos);
        pos += data.length;
        yield data;
      }
    } finally {
      await raf.close();
    }
  }
}

/// AES-CTR keystream at an arbitrary byte offset: counter = nonce (128-bit big-endian) + block index.
class _Ctr {
  _Ctr(Uint8List key, this._nonce) : _aes = AESEngine()..init(true, KeyParameter(key));

  final AESEngine _aes;
  final Uint8List _nonce;
  final _counter = Uint8List(16);
  final _stream = Uint8List(16);

  void _counterFor(int block) {
    var carry = block;
    for (var i = 15; i >= 0; i--) {
      final sum = _nonce[i] + (carry & 0xff);
      _counter[i] = sum & 0xff;
      carry = (carry >> 8) + (sum >> 8);
    }
  }

  void xorAt(Uint8List data, int offset) {
    var block = offset ~/ 16;
    var skip = offset % 16;
    var i = 0;
    while (i < data.length) {
      _counterFor(block);
      _aes.processBlock(_counter, 0, _stream, 0);
      for (var j = skip; j < 16 && i < data.length; j++, i++) {
        data[i] ^= _stream[j];
      }
      skip = 0;
      block++;
    }
  }
}
