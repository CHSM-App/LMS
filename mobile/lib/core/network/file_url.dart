import '../env.dart';

/// The API returns its own files as relative signed links ("/api/v1/files/...").
/// Makes them absolute against the API host so the app can load them; full URLs pass through.
String? absoluteFileUrl(String? url, {String base = Env.apiBaseUrl}) {
  if (url == null || url.isEmpty) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  final b = Uri.parse(base);
  return '${b.scheme}://${b.authority}$url';
}
