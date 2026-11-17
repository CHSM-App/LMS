// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get appName => 'LMS';

  @override
  String get appTagline => 'भरोसेमंद शिक्षकों से सीखें';

  @override
  String get loginTitle => 'लॉग इन';

  @override
  String get loginIntro =>
      'अपना मोबाइल नंबर डालें। हम एक वन-टाइम पासवर्ड भेजेंगे।';

  @override
  String get mobileNumber => 'मोबाइल नंबर';

  @override
  String get mobileHint => '10 अंकों का मोबाइल नंबर';

  @override
  String get invalidMobile => 'सही 10 अंकों का मोबाइल नंबर लिखें';

  @override
  String get sendOtp => 'OTP भेजें';

  @override
  String otpSentTo(String mobile) {
    return '$mobile पर OTP भेजा गया।';
  }

  @override
  String get changeNumber => 'नंबर बदलें';

  @override
  String get verifyLogin => 'जाँचें और लॉग इन करें';

  @override
  String resendIn(int s) {
    return '$s सेकंड में OTP फिर भेजें';
  }

  @override
  String get resendOtp => 'OTP फिर भेजें';

  @override
  String get adminWebOnly =>
      'एडमिन टूल वेबसाइट पर हैं। शिक्षकों को प्रबंधित करने के लिए वहाँ लॉग इन करें।';

  @override
  String get logout => 'लॉग आउट';

  @override
  String get dashboard => 'डैशबोर्ड';

  @override
  String get account => 'खाता';

  @override
  String hello(String name) {
    return 'नमस्ते, $name';
  }

  @override
  String get changeMobile => 'मोबाइल नंबर बदलें';

  @override
  String get newMobile => 'नया मोबाइल नंबर';

  @override
  String get mobileChanged => 'मोबाइल नंबर बदल गया';

  @override
  String get deleteAccount => 'मेरा खाता हटाएँ';

  @override
  String get deleteAccountIntro =>
      'इससे आपका नाम, मोबाइल नंबर, ईमेल और फ़ोटो हट जाएँगे। परीक्षा और उपस्थिति के रिकॉर्ड शिक्षक के पास \"हटाया गया उपयोगकर्ता\" के रूप में रहेंगे। इसे वापस नहीं किया जा सकता।';

  @override
  String get accountDeleted => 'आपका खाता हटा दिया गया';
}
