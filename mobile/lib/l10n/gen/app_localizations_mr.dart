// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Marathi (`mr`).
class AppLocalizationsMr extends AppLocalizations {
  AppLocalizationsMr([String locale = 'mr']) : super(locale);

  @override
  String get appName => 'LMS';

  @override
  String get appTagline => 'विश्वासू शिक्षकांकडून शिका';

  @override
  String get loginTitle => 'लॉग इन';

  @override
  String get loginIntro =>
      'तुमचा मोबाईल नंबर वापरा. आम्ही एक-वेळ पासवर्ड पाठवू.';

  @override
  String get mobileNumber => 'मोबाईल नंबर';

  @override
  String get mobileHint => '10 अंकी मोबाईल नंबर';

  @override
  String get invalidMobile => 'योग्य 10 अंकी मोबाईल नंबर लिहा';

  @override
  String get sendOtp => 'OTP पाठवा';

  @override
  String otpSentTo(String mobile) {
    return '$mobile वर OTP पाठवला.';
  }

  @override
  String get changeNumber => 'नंबर बदला';

  @override
  String get verifyLogin => 'पडताळा आणि लॉग इन करा';

  @override
  String resendIn(int s) {
    return '$s सेकंदात OTP पुन्हा पाठवा';
  }

  @override
  String get resendOtp => 'OTP पुन्हा पाठवा';

  @override
  String get adminWebOnly =>
      'प्रशासकाची साधने वेबसाइटवर आहेत. शिक्षक व्यवस्थापनासाठी तेथे लॉग इन करा.';

  @override
  String get logout => 'लॉग आउट';

  @override
  String get dashboard => 'डॅशबोर्ड';

  @override
  String get account => 'खाते';

  @override
  String hello(String name) {
    return 'नमस्कार, $name';
  }

  @override
  String get changeMobile => 'मोबाईल नंबर बदला';

  @override
  String get newMobile => 'नवीन मोबाईल नंबर';

  @override
  String get mobileChanged => 'मोबाईल नंबर बदलला';

  @override
  String get deleteAccount => 'माझे खाते हटवा';

  @override
  String get deleteAccountIntro =>
      'यामुळे तुमचे नाव, मोबाईल नंबर, ईमेल आणि फोटो काढले जातील. परीक्षा आणि उपस्थितीच्या नोंदी शिक्षकाकडे \"हटवलेला वापरकर्ता\" म्हणून राहतील. हे परत करता येणार नाही.';

  @override
  String get accountDeleted => 'तुमचे खाते हटवले';
}
