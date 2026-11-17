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

  @override
  String get tRequests => 'विनंत्या';

  @override
  String get tStudents => 'विद्यार्थी';

  @override
  String get tClasses => 'वर्ग';

  @override
  String get tDoubts => 'शंका';

  @override
  String get tDemoWaiting => 'प्रलंबित डेमो विनंत्या';

  @override
  String get tEnrollWaiting => 'प्रवेशासाठी थांबलेले विद्यार्थी';

  @override
  String get tOpenDoubts => 'उघड्या शंका';

  @override
  String get tActiveStudents => 'सक्रिय विद्यार्थी';

  @override
  String get tToday => 'आजचे थेट वर्ग';

  @override
  String get tNoClasses => 'थेट वर्ग नाहीत';

  @override
  String get tClassesOnWeb => 'वेबसाइटवर वर्ग ठरवा; ते येथे दिसतील.';

  @override
  String get tDemoTab => 'थेट डेमो';

  @override
  String get tEnrollTab => 'प्रवेश';

  @override
  String get tNoDemos => 'डेमो विनंत्या नाहीत';

  @override
  String get tNoEnrollments => 'कोणीही थांबलेले नाही';

  @override
  String get tNoStudents => 'अद्याप विद्यार्थी नाहीत';

  @override
  String get tNoDoubts => 'उघड्या शंका नाहीत';

  @override
  String get join => 'सामील व्हा';

  @override
  String get schedule => 'वेळ ठरवा';

  @override
  String get reschedule => 'वेळ बदला';

  @override
  String get sendWhatsApp => 'WhatsApp वर पाठवा';

  @override
  String get waSent => 'पाठवले ✓';

  @override
  String get waNotSent => 'WhatsApp संदेश पाठवला नाही';

  @override
  String get approve => 'मंजूर करा';

  @override
  String get approveStudent => 'विद्यार्थी मंजूर करा';

  @override
  String approveTitle(String name) {
    return '$name यांना मंजूर करा';
  }

  @override
  String get approvedMsg => 'विद्यार्थी मंजूर';

  @override
  String get batch => 'बॅच';

  @override
  String get startDate => 'सुरुवात';

  @override
  String get endDate => 'शेवट';

  @override
  String get needBatch => 'बॅच निवडा';

  @override
  String get needDates => 'सुरुवात आणि शेवटची तारीख निवडा';

  @override
  String get dateOrder =>
      'शेवटची तारीख सुरुवातीच्या तारखेनंतर किंवा त्याच दिवशी हवी';

  @override
  String get needWhen => 'तारीख आणि वेळ निवडा';

  @override
  String get minReason => 'किमान 5 अक्षरे लिहा';

  @override
  String get requiredField => 'हे क्षेत्र आवश्यक आहे';

  @override
  String accessUntil(String date) {
    return '$date पर्यंत प्रवेश';
  }

  @override
  String get attendance => 'उपस्थिती';

  @override
  String get markAllPresent => 'सर्व उपस्थित';

  @override
  String presentCount(int present, int total) {
    return '$total पैकी $present उपस्थित';
  }

  @override
  String get present => 'उपस्थित';

  @override
  String get absent => 'अनुपस्थित';

  @override
  String get saveAttendance => 'उपस्थिती जतन करा';

  @override
  String get saved => 'जतन केले';

  @override
  String get reply => 'उत्तर द्या';

  @override
  String replyTo(String name) {
    return '$name यांना उत्तर';
  }

  @override
  String get yourReply => 'तुमचे उत्तर';

  @override
  String get sendReply => 'उत्तर पाठवा';

  @override
  String get replySent => 'उत्तर पाठवले';

  @override
  String get cancel => 'रद्द करा';

  @override
  String get tryAgain => 'पुन्हा प्रयत्न करा';
}
