import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/session/session.dart';
import 'package:lms_app/core/storage/token_storage.dart';
import 'package:lms_app/data/repositories/auth_repository.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/main.dart';
import 'package:lms_app/presentation/providers/core_providers.dart';

class _NoTokens implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<String?> readRefresh() async => null;
  @override
  Future<void> save({required String accessToken, String? refreshToken}) async {}
}

class _LoggedOutRepo implements AuthRepository {
  _LoggedOutRepo(this.session);
  final SessionController session;
  @override
  Future<SessionUser> login(String mobile, String otp) => throw UnimplementedError();
  @override
  Future<void> logout() async {}
  @override
  Future<SessionUser?> restore() async {
    session.finishRestore();
    return null;
  }

  @override
  Future<int> sendOtp(String mobile, String purpose) async => 30;
}

void main() {
  testWidgets('logged-out start goes from splash to the login screen', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(_NoTokens()),
        authRepositoryProvider.overrideWith((ref) => _LoggedOutRepo(ref.read(sessionProvider.notifier))),
      ],
      child: const LmsApp(),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();
    expect(find.text('Send OTP'), findsOneWidget);
  });

  test('supports en, mr and hi', () {
    final codes = AppLocalizations.supportedLocales.map((l) => l.languageCode).toSet();
    expect(codes, containsAll(['en', 'mr', 'hi']));
  });
}
