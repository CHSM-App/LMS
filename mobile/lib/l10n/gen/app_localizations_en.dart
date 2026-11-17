// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'LMS';

  @override
  String get appTagline => 'Learn from teachers you trust';

  @override
  String get loginTitle => 'Log in';

  @override
  String get loginIntro =>
      'Use your mobile number. We\'ll send you a one-time password.';

  @override
  String get mobileNumber => 'Mobile number';

  @override
  String get mobileHint => '10-digit mobile number';

  @override
  String get invalidMobile => 'Enter a valid 10-digit mobile number';

  @override
  String get sendOtp => 'Send OTP';

  @override
  String otpSentTo(String mobile) {
    return 'OTP sent to $mobile.';
  }

  @override
  String get changeNumber => 'Change number';

  @override
  String get verifyLogin => 'Verify and log in';

  @override
  String resendIn(int s) {
    return 'Resend OTP in ${s}s';
  }

  @override
  String get resendOtp => 'Resend OTP';

  @override
  String get adminWebOnly =>
      'Admin tools are on the website. Log in there to manage teachers.';

  @override
  String get logout => 'Log out';

  @override
  String get dashboard => 'Dashboard';

  @override
  String get account => 'Account';

  @override
  String hello(String name) {
    return 'Hello, $name';
  }

  @override
  String get changeMobile => 'Change mobile number';

  @override
  String get newMobile => 'New mobile number';

  @override
  String get mobileChanged => 'Mobile number changed';

  @override
  String get deleteAccount => 'Delete my account';

  @override
  String get deleteAccountIntro =>
      'This removes your name, mobile number, email and photo. Your teacher keeps exam and attendance records as \"Deleted user\". This can\'t be undone.';

  @override
  String get accountDeleted => 'Your account was deleted';
}
