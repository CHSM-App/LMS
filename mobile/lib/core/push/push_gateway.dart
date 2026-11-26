import 'package:firebase_messaging/firebase_messaging.dart';

/// A push message reduced to what the app uses.
class PushMessage {
  const PushMessage({required this.title, required this.body, this.link});

  final String title;
  final String body;

  /// In-app path such as `/student/notifications` (already checked with [safePushLink] by the caller).
  final String? link;
}

/// The Firebase calls the app needs, behind an interface so tests never touch Firebase.
abstract class PushGateway {
  Future<bool> requestPermission();
  Future<String?> token();
  Stream<String> get onTokenRefresh;

  /// Messages that arrive while the app is open (Android shows no system notification for these).
  Stream<PushMessage> get onForeground;

  /// The user tapped a notification while the app was in the background.
  Stream<PushMessage> get onOpened;

  /// The notification that launched the app from a closed state, if any.
  Future<PushMessage?> initialMessage();
  Future<void> deleteToken();
}

PushMessage _toMessage(RemoteMessage m) => PushMessage(
      title: m.notification?.title ?? '',
      body: m.notification?.body ?? '',
      link: m.data['link'] as String?,
    );

class FirebasePushGateway implements PushGateway {
  FirebasePushGateway([FirebaseMessaging? messaging]) : _fm = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _fm;

  @override
  Future<bool> requestPermission() async {
    final s = await _fm.requestPermission();
    return s.authorizationStatus == AuthorizationStatus.authorized || s.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> token() => _fm.getToken();

  @override
  Stream<String> get onTokenRefresh => _fm.onTokenRefresh;

  @override
  Stream<PushMessage> get onForeground => FirebaseMessaging.onMessage.map(_toMessage);

  @override
  Stream<PushMessage> get onOpened => FirebaseMessaging.onMessageOpenedApp.map(_toMessage);

  @override
  Future<PushMessage?> initialMessage() async {
    final m = await _fm.getInitialMessage();
    return m == null ? null : _toMessage(m);
  }

  @override
  Future<void> deleteToken() => _fm.deleteToken();
}
