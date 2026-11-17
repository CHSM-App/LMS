import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'encrypted_store.dart';

/// Serves one decrypted offline video to the in-app player over 127.0.0.1 only, on a random port
/// with a random path token, honouring Range requests so seeking works. The plain bytes never touch disk.
class DecryptStreamServer {
  DecryptStreamServer._(this._server, this._token, this._file, this._key);

  final HttpServer _server;
  final String _token;
  final File _file;
  final Uint8List _key;

  static Future<DecryptStreamServer> start(File file, Uint8List key) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final rnd = Random.secure();
    final token = List.generate(24, (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    final s = DecryptStreamServer._(server, token, file, key);
    server.listen(s._handle);
    return s;
  }

  Uri get url => Uri.parse('http://127.0.0.1:${_server.port}/$_token.mp4');

  Future<void> _handle(HttpRequest req) async {
    final res = req.response;
    if (req.uri.path != '/$_token.mp4' || (req.method != 'GET' && req.method != 'HEAD')) {
      res.statusCode = HttpStatus.notFound;
      await res.close();
      return;
    }
    final total = EncryptedStore.plainLength(_file);
    var start = 0;
    var end = total; // exclusive
    final range = req.headers.value(HttpHeaders.rangeHeader);
    final m = range == null ? null : RegExp(r'^bytes=(\d*)-(\d*)$').firstMatch(range.trim());
    if (m != null) {
      final a = m.group(1)!;
      final b = m.group(2)!;
      if (a.isEmpty && b.isNotEmpty) {
        start = max(0, total - int.parse(b));
      } else {
        start = int.parse(a.isEmpty ? '0' : a);
        if (b.isNotEmpty) end = min(total, int.parse(b) + 1);
      }
      if (start >= total || start >= end) {
        res.statusCode = HttpStatus.requestedRangeNotSatisfiable;
        res.headers.set(HttpHeaders.contentRangeHeader, 'bytes */$total');
        await res.close();
        return;
      }
      res.statusCode = HttpStatus.partialContent;
      res.headers.set(HttpHeaders.contentRangeHeader, 'bytes $start-${end - 1}/$total');
    }
    res.headers
      ..contentType = ContentType('video', 'mp4')
      ..contentLength = end - start
      ..set(HttpHeaders.acceptRangesHeader, 'bytes')
      ..set(HttpHeaders.cacheControlHeader, 'no-store');
    if (req.method == 'HEAD') {
      await res.close();
      return;
    }
    try {
      await res.addStream(EncryptedStore.openRead(_file, _key, start, end));
    } catch (_) {
      // Player closed the connection while seeking.
    }
    await res.close();
  }

  Future<void> close() => _server.close(force: true);
}
