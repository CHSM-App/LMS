import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/offline/decrypt_stream_server.dart';
import 'package:lms_app/core/offline/encrypted_store.dart';

import 'offline_fakes.dart';

void main() {
  late Directory dir;
  late DecryptStreamServer server;
  final key = Uint8List.fromList(List.generate(32, (i) => 255 - i));
  final plain = sampleBytes(200000);

  setUp(() async {
    dir = Directory.systemTemp.createTempSync('srv');
    final src = File('${dir.path}/p')..writeAsBytesSync(plain);
    final enc = File('${dir.path}/v.bin');
    await EncryptedStore.encryptFile(src, enc, key);
    src.deleteSync();
    server = await DecryptStreamServer.start(enc, key);
  });
  tearDown(() async {
    await server.close();
    dir.deleteSync(recursive: true);
  });

  Future<(int, List<int>, HttpHeaders)> get(Uri u, [String? range]) async {
    final c = HttpClient();
    try {
      final req = await c.getUrl(u);
      if (range != null) req.headers.set(HttpHeaders.rangeHeader, range);
      final res = await req.close();
      final bytes = await res.fold<List<int>>([], (a, b) => a..addAll(b));
      return (res.statusCode, bytes, res.headers);
    } finally {
      c.close(force: true);
    }
  }

  test('listens on loopback only, with a random token path', () async {
    expect(server.url.host, '127.0.0.1');
    expect(server.url.path.length, greaterThan(40));
    final (status, _, _) = await get(server.url.replace(path: '/video.mp4'));
    expect(status, 404);
  });

  test('serves the whole decrypted video', () async {
    final (status, bytes, headers) = await get(server.url);
    expect(status, 200);
    expect(bytes, equals(plain));
    expect(headers.value('accept-ranges'), 'bytes');
    expect(headers.value('cache-control'), 'no-store');
  });

  test('Range requests return the right decrypted slice (seeking)', () async {
    final (status, bytes, headers) = await get(server.url, 'bytes=100000-100099');
    expect(status, 206);
    expect(bytes, equals(plain.sublist(100000, 100100)));
    expect(headers.value('content-range'), 'bytes 100000-100099/200000');
    final (s2, tail, _) = await get(server.url, 'bytes=-10');
    expect(s2, 206);
    expect(tail, equals(plain.sublist(199990)));
    final (s3, _, _) = await get(server.url, 'bytes=999999-');
    expect(s3, 416);
  });
}
