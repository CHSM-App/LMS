import 'dart:async';

import 'package:dio/dio.dart';

import '../session/session.dart';
import '../storage/token_storage.dart';

/// Typed failure surfaced to repositories/viewmodels (Flutter_ARCHITECTURE §15.9).
class ApiException implements Exception {
  const ApiException(this.status, this.message, [this.code, this.details]);

  final int status;
  final String message;
  final String? code;

  /// Extra data from the server, e.g. { fallbackUrl } for WhatsApp or { missing } for publishing.
  final Map<String, dynamic>? details;

  bool get isNetwork => status == 0;

  @override
  String toString() => message;
}

/// Dio wrapper: attaches the access token, refreshes once for concurrent 401s (fixes §14.3),
/// unwraps the { success, data } envelope and maps errors to [ApiException].
class ApiClient {
  ApiClient({required String baseUrl, required this.session, required this.store, HttpClientAdapter? adapter})
      : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'X-Client': 'mobile'},
          validateStatus: (_) => true,
        )) {
    if (adapter != null) _dio.httpClientAdapter = adapter;
  }

  final Dio _dio;
  final SessionController session;
  final TokenStore store;
  Future<String?>? _refreshing;

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _send('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body ?? <String, dynamic>{});
  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body: body ?? <String, dynamic>{});
  Future<dynamic> delete(String path, [Object? body]) => _send('DELETE', path, body: body);

  /// POST with extra headers (e.g. X-Device-Id for offline download licences).
  Future<dynamic> postWith(String path, Object? body, Map<String, String> headers) async =>
      (await _raw('POST', path, body: body ?? <String, dynamic>{}, headers: headers))['data'];

  /// Multipart POST (doubt attachments). Fields are strings; [file] is optional.
  Future<dynamic> postForm(String path, Map<String, String> fields, {String? fileField, String? filePath}) async {
    final form = FormData.fromMap({
      ...fields,
      if (fileField != null && filePath != null) fileField: await MultipartFile.fromFile(filePath),
    });
    return (await _raw('POST', path, body: form))['data'];
  }

  /// Returns the full envelope (data + pagination) for list endpoints.
  Future<Map<String, dynamic>> getPage(String path, {Map<String, dynamic>? query}) async {
    final res = await _raw('GET', path, query: query);
    return res;
  }

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, dynamic>? query}) async {
    final res = await _raw(method, path, body: body, query: query);
    return res['data'];
  }

  Future<Map<String, dynamic>> _raw(String method, String path, {Object? body, Map<String, dynamic>? query, Map<String, String>? headers, bool retried = false}) async {
    Response<dynamic> res;
    try {
      res = await _dio.request<dynamic>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method, headers: {
          ...?headers,
          if (session.current.accessToken != null) 'Authorization': 'Bearer ${session.current.accessToken}',
        }),
      );
    } on DioException {
      throw const ApiException(0, "You're offline. Check your connection and try again.", 'NETWORK');
    }
    final json = res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : <String, dynamic>{};
    final status = res.statusCode ?? 0;
    if (status >= 200 && status < 300 && json['success'] != false) return json;

    final err = ApiException(status, (json['error'] ?? 'Something went wrong. Try again.') as String, json['code'] as String?, json['details'] as Map<String, dynamic>?);
    if (status == 401 && err.code == 'TOKEN_EXPIRED' && !retried) {
      await refresh();
      return _raw(method, path, body: body, query: query, headers: headers, retried: true);
    }
    if (status == 401 && const {'ACCOUNT_BLOCKED', 'SESSION_ENDED', 'TOKEN_REUSED'}.contains(err.code)) {
      await session.end(err.message);
    }
    throw err;
  }

  /// One refresh in flight; concurrent callers await the same future.
  Future<String?> refresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<String?> _doRefresh() async {
    final rt = await store.readRefresh();
    if (rt == null) {
      await session.end();
      throw const ApiException(401, 'Log in to continue', 'AUTH_REQUIRED');
    }
    final res = await _dio.post<dynamic>('/auth/refresh', data: {'refreshToken': rt});
    final json = res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : <String, dynamic>{};
    if ((res.statusCode ?? 0) != 200) {
      await session.end((json['error'] ?? 'Your session has ended. Log in again.') as String);
      throw ApiException(401, (json['error'] ?? 'Your session has ended. Log in again.') as String, json['code'] as String?);
    }
    final data = json['data'] as Map<String, dynamic>;
    final access = data['accessToken'] as String;
    await store.save(accessToken: access, refreshToken: data['refreshToken'] as String?);
    session.setAccessToken(access);
    return access;
  }
}
