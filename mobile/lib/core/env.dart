/// Build-time configuration: flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
abstract final class Env {
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://192.168.1.3:4000/api/v1');
  static const isRelease = bool.fromEnvironment('dart.vm.product');
}
