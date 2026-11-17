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

  @override
  String get tRequests => 'अनुरोध';

  @override
  String get tStudents => 'छात्र';

  @override
  String get tClasses => 'क्लास';

  @override
  String get tDoubts => 'संदेह';

  @override
  String get tDemoWaiting => 'लंबित डेमो अनुरोध';

  @override
  String get tEnrollWaiting => 'नामांकन के लिए रुके छात्र';

  @override
  String get tOpenDoubts => 'खुले संदेह';

  @override
  String get tActiveStudents => 'सक्रिय छात्र';

  @override
  String get tToday => 'आज की लाइव क्लास';

  @override
  String get tNoClasses => 'कोई लाइव क्लास नहीं';

  @override
  String get tClassesOnWeb => 'वेबसाइट पर क्लास तय करें; वे यहाँ दिखेंगी।';

  @override
  String get tDemoTab => 'लाइव डेमो';

  @override
  String get tEnrollTab => 'नामांकन';

  @override
  String get tNoDemos => 'कोई डेमो अनुरोध नहीं';

  @override
  String get tNoEnrollments => 'कोई इंतज़ार नहीं कर रहा';

  @override
  String get tNoStudents => 'अभी कोई छात्र नहीं';

  @override
  String get tNoDoubts => 'कोई खुला संदेह नहीं';

  @override
  String get join => 'जुड़ें';

  @override
  String get schedule => 'समय तय करें';

  @override
  String get reschedule => 'समय बदलें';

  @override
  String get sendWhatsApp => 'WhatsApp पर भेजें';

  @override
  String get waSent => 'भेजा गया ✓';

  @override
  String get waNotSent => 'WhatsApp संदेश नहीं भेजा गया';

  @override
  String get approve => 'स्वीकार करें';

  @override
  String get approveStudent => 'छात्र को स्वीकार करें';

  @override
  String approveTitle(String name) {
    return '$name को स्वीकार करें';
  }

  @override
  String get approvedMsg => 'छात्र स्वीकृत';

  @override
  String get batch => 'बैच';

  @override
  String get startDate => 'शुरुआत';

  @override
  String get endDate => 'समाप्ति';

  @override
  String get needBatch => 'बैच चुनें';

  @override
  String get needDates => 'शुरुआत और समाप्ति की तारीख चुनें';

  @override
  String get dateOrder =>
      'समाप्ति की तारीख शुरुआत के बाद या उसी दिन होनी चाहिए';

  @override
  String get needWhen => 'तारीख और समय चुनें';

  @override
  String get minReason => 'कम से कम 5 अक्षर लिखें';

  @override
  String get requiredField => 'यह फ़ील्ड ज़रूरी है';

  @override
  String accessUntil(String date) {
    return '$date तक एक्सेस';
  }

  @override
  String get attendance => 'उपस्थिति';

  @override
  String get markAllPresent => 'सभी उपस्थित';

  @override
  String presentCount(int present, int total) {
    return '$total में से $present उपस्थित';
  }

  @override
  String get present => 'उपस्थित';

  @override
  String get absent => 'अनुपस्थित';

  @override
  String get saveAttendance => 'उपस्थिति सहेजें';

  @override
  String get saved => 'सहेजा गया';

  @override
  String get reply => 'उत्तर दें';

  @override
  String replyTo(String name) {
    return '$name को उत्तर';
  }

  @override
  String get yourReply => 'आपका उत्तर';

  @override
  String get sendReply => 'उत्तर भेजें';

  @override
  String get replySent => 'उत्तर भेजा गया';

  @override
  String get cancel => 'रद्द करें';

  @override
  String get tryAgain => 'फिर से कोशिश करें';
}
