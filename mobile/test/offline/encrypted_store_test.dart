import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/offline/encrypted_store.dart';

import 'offline_fakes.dart';

void main() {
  late Directory dir;
  final key = Uint8List.fromList(List.generate(32, (i) => i * 7 & 0xff));
  setUp(() => dir = Directory.systemTemp.createTempSync('enc'));
  tearDown(() => dir.deleteSync(recursive: true));

  test('10 MB encrypt → decrypt round trip is byte-identical, and the stored file never holds the plain bytes', () async {
    final plain = sampleBytes(10 * 1024 * 1024 + 123);
    final src = File('${dir.path}/plain.mp4')..writeAsBytesSync(plain);
    final dst = File('${dir.path}/x.bin');
    await EncryptedStore.encryptFile(src, dst, key);

    final stored = dst.readAsBytesSync();
    expect(EncryptedStore.plainLength(dst), plain.length);
    expect(stored.sublist(EncryptedStore.headerLength, EncryptedStore.headerLength + 1024), isNot(equals(plain.sublist(0, 1024))));
    expect(utf8.decode(stored.sublist(0, 4096), allowMalformed: true).contains(utf8.decode(plain.sublist(0, 64), allowMalformed: true)), isFalse);

    final out = BytesBuilder(copy: false);
    await for (final chunk in EncryptedStore.openRead(dst, key)) {
      out.add(chunk);
    }
    expect(out.takeBytes(), equals(plain));
  });

  test('seeking to any offset decrypts the right bytes (CTR)', () async {
    final plain = sampleBytes(300000);
    final src = File('${dir.path}/plain.mp4')..writeAsBytesSync(plain);
    final dst = File('${dir.path}/x.bin');
    await EncryptedStore.encryptFile(src, dst, key);
    for (final (start, end) in [(0, 15), (17, 40), (65535, 65600), (123457, 200001), (299990, 300000)]) {
      final got = BytesBuilder();
      await for (final c in EncryptedStore.openRead(dst, key, start, end)) {
        got.add(c);
      }
      expect(got.takeBytes(), equals(plain.sublist(start, end)), reason: 'range $start-$end');
    }
  });

  test('a wrong key gives garbage, not the video', () async {
    final plain = sampleBytes(5000);
    final src = File('${dir.path}/p')..writeAsBytesSync(plain);
    final dst = File('${dir.path}/x.bin');
    await EncryptedStore.encryptFile(src, dst, key);
    final wrong = Uint8List(32);
    final got = BytesBuilder();
    await for (final c in EncryptedStore.openRead(dst, wrong)) {
      got.add(c);
    }
    expect(got.takeBytes(), isNot(equals(plain)));
  });
}
