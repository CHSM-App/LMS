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

  @override
  String get sHome => 'मुख्यपृष्ठ';

  @override
  String get sExams => 'परीक्षा';

  @override
  String get sClasses => 'वर्ग';

  @override
  String get sDoubts => 'शंका';

  @override
  String get sMore => 'अधिक';

  @override
  String get sNextUp => 'पुढचा धडा';

  @override
  String get sContinue => 'पुढे सुरू ठेवा';

  @override
  String get sMyCourses => 'माझे अभ्यासक्रम';

  @override
  String get sNoCourses =>
      'तुम्ही अद्याप कोणत्याही अभ्यासक्रमात प्रवेश घेतलेला नाही.';

  @override
  String get sBrowse => 'अभ्यासक्रम पहा';

  @override
  String sUntil(String date) {
    return '$date पर्यंत प्रवेश';
  }

  @override
  String get sReadOnly =>
      'तुमच्या शिक्षकांचे खाते निष्क्रिय आहे. तुम्ही पूर्ण केलेले धडे तरीही उघडू शकता.';

  @override
  String get sUpcoming => 'आगामी थेट वर्ग';

  @override
  String get sNoUpcoming => 'आगामी थेट वर्ग नाहीत';

  @override
  String get sRequests => 'तुम्ही पाठवलेल्या विनंत्या';

  @override
  String get sLessons => 'धडे';

  @override
  String get sMarkComplete => 'पूर्ण झाले म्हणून चिन्हांकित करा';

  @override
  String get sCompleted => 'पूर्ण';

  @override
  String get sOpenNotes => 'नोट्स उघडा';

  @override
  String get sOpenLink => 'लिंक उघडा';

  @override
  String get sWatchOnSite => 'व्हिडिओ पहा';

  @override
  String get sNoLessons => 'अद्याप धडे नाहीत';

  @override
  String get sLocked => 'बंद';

  @override
  String get sDownload => 'डाउनलोड';

  @override
  String get sDownloaded => 'डाउनलोड झाले';

  @override
  String sDownloading(String pct) {
    return 'डाउनलोड होत आहे $pct%';
  }

  @override
  String get sPaused => 'थांबवले';

  @override
  String get sQueued => 'प्रतीक्षेत…';

  @override
  String get sWaitingWifi => 'Wi-Fi ची प्रतीक्षा';

  @override
  String sNotEnoughSpace(String mb) {
    return 'पुरेशी जागा नाही. $mb MB जागा मोकळी करा';
  }

  @override
  String get sDeviceLimit =>
      'डाउनलोड 2 उपकरणांवर चालतात. प्रोफाइल → डाउनलोड मधून एक काढा.';

  @override
  String get sDownloadFailed => 'डाउनलोड अयशस्वी. पुन्हा प्रयत्न करा.';

  @override
  String get sLicenseExpired => 'ऑफलाइन पाहत राहण्यासाठी इंटरनेटशी जोडा';

  @override
  String sRemoved(String title, String reason) {
    return 'काढले: $title ($reason)';
  }

  @override
  String get sReasonSubscription => 'सदस्यता संपली';

  @override
  String get sReasonTeacher => 'शिक्षक निष्क्रिय';

  @override
  String get sReasonPaused => 'प्रवेश थांबवला';

  @override
  String get sReasonDevice => 'उपकरण काढले';

  @override
  String get sReasonOther => 'आता उपलब्ध नाही';

  @override
  String get sDownloads => 'डाउनलोड';

  @override
  String get sNoDownloads => 'डाउनलोड केलेले व्हिडिओ नाहीत';

  @override
  String sStorageUsed(String size) {
    return 'या फोनवर $size वापरले';
  }

  @override
  String get sWifiOnly => 'फक्त Wi-Fi वर डाउनलोड करा';

  @override
  String get sDeleteAll => 'सर्व हटवा';

  @override
  String get sDelete => 'हटवा';

  @override
  String get sPause => 'थांबवा';

  @override
  String get sResume => 'पुढे सुरू करा';

  @override
  String sExpires(String date) {
    return '$date पर्यंत ऑफलाइन पाहा';
  }

  @override
  String get sDevices => 'डाउनलोड असलेली उपकरणे';

  @override
  String get sRemove => 'काढा';

  @override
  String get sThisDevice => 'हा फोन';

  @override
  String get sChooseCourse => 'अभ्यासक्रम निवडा';

  @override
  String get sStart => 'सुरू करा';

  @override
  String get sResumeExam => 'पुढे सुरू ठेवा';

  @override
  String get sFinalLocked =>
      'अंतिम परीक्षा उघडण्यासाठी सर्व घटक चाचण्या पूर्ण करा.';

  @override
  String get sNoAttempts => 'प्रयत्न शिल्लक नाहीत';

  @override
  String sAttemptsLeft(String n) {
    return 'शिल्लक प्रयत्न: $n';
  }

  @override
  String sBest(String pct) {
    return 'सर्वोत्तम: $pct%';
  }

  @override
  String get sViewResult => 'निकाल पहा';

  @override
  String get sNoExams => 'अद्याप परीक्षा नाहीत';

  @override
  String sQuestionN(String n) {
    return 'प्रश्न $n';
  }

  @override
  String get sYourAnswer => 'तुमचे उत्तर';

  @override
  String sAnswered(String n, int total) {
    return '$total पैकी $n उत्तरे दिली';
  }

  @override
  String get sSaving => 'जतन होत आहे…';

  @override
  String get sSaved => 'जतन झाले';

  @override
  String get sOffline => 'ऑफलाइन — उत्तरे नंतर पाठवली जातील';

  @override
  String get sSubmit => 'परीक्षा सबमिट करा';

  @override
  String get sSubmitTitle => 'परीक्षा सबमिट करायची?';

  @override
  String sSubmitBody(String n, int total) {
    return 'तुम्ही $total पैकी $n प्रश्नांची उत्तरे दिली. सबमिटनंतर उत्तरे बदलता येणार नाहीत.';
  }

  @override
  String get sKeepGoing => 'उत्तरे देत राहा';

  @override
  String get sSubmitNow => 'आता सबमिट करा';

  @override
  String get sCorrect => 'बरोबर';

  @override
  String get sWrong => 'चूक';

  @override
  String sTimeLeft(String time) {
    return 'उरलेला वेळ $time';
  }

  @override
  String get sResult => 'निकाल';

  @override
  String sRank(String rank, String of) {
    return '$of पैकी क्रमांक $rank';
  }

  @override
  String get sPassed => 'उत्तीर्ण';

  @override
  String get sFailed => 'अनुत्तीर्ण';

  @override
  String get sAuto => 'वेळ संपल्यावर आपोआप सबमिट झाले';

  @override
  String get sReview => 'उत्तर तपासणी';

  @override
  String get sSolutionImage => 'उत्तराचा फोटो';

  @override
  String get sCorrectAnswer => 'बरोबर उत्तर';

  @override
  String get sNotAnswered => 'उत्तर दिले नाही';

  @override
  String get sAskDoubt => 'शंका विचारा';

  @override
  String get sQuestion => 'तुमचा प्रश्न';

  @override
  String get sSendToTeacher => 'शिक्षकांना पाठवा';

  @override
  String get sDoubtSent => 'शंका शिक्षकांना पाठवली';

  @override
  String get sNoDoubts => 'तुम्ही अद्याप शंका विचारलेली नाही';

  @override
  String get sWaitingReply => 'शिक्षकांच्या उत्तराची प्रतीक्षा';

  @override
  String get sProgress => 'प्रगती';

  @override
  String sLessonsDone(String done, int total) {
    return '$total पैकी $done धडे पूर्ण';
  }

  @override
  String sAttendance(String pct, String attended, String held) {
    return 'उपस्थिती: $pct% ($held पैकी $attended वर्ग)';
  }

  @override
  String get sProfile => 'प्रोफाइल';

  @override
  String get sName => 'नाव';

  @override
  String get sEducation => 'शिक्षण';

  @override
  String get sClass => 'इयत्ता';

  @override
  String get sCity => 'शहर';

  @override
  String get sEmail => 'ईमेल';

  @override
  String get sLanguage => 'भाषा';

  @override
  String get sNotifications => 'सूचना';

  @override
  String get sNoNotifications => 'सूचना नाहीत';

  @override
  String get sMarkAllRead => 'सर्व वाचले म्हणून चिन्हांकित करा';

  @override
  String get sLiveClasses => 'थेट वर्ग';

  @override
  String sOptional(String label) {
    return '$label (ऐच्छिक)';
  }

  @override
  String get pCourses => 'अभ्यासक्रम';

  @override
  String get pSearch => 'अभ्यासक्रम शोधा';

  @override
  String get pNoResults => 'तुमच्या शोधाशी जुळणारे अभ्यासक्रम नाहीत';

  @override
  String pBy(String teacher) {
    return '$teacher यांच्याकडून';
  }

  @override
  String get pDemoVideos => 'डेमो व्हिडिओ';

  @override
  String get pCurriculum => 'तुम्ही काय शिकाल';

  @override
  String get pBatches => 'बॅच';

  @override
  String get pRequestDemo => 'थेट डेमोची विनंती करा';

  @override
  String get pEnroll => 'आता प्रवेश घ्या';

  @override
  String get pDemoSent => 'विनंती पाठवली. शिक्षक डेमोची वेळ तुम्हाला कळवतील.';

  @override
  String get pPreferredTime => 'सोयीची वेळ';

  @override
  String get pMessage => 'संदेश';

  @override
  String get pAcceptTerms => 'मी अटी आणि गोपनीयता धोरण स्वीकारतो/स्वीकारते';

  @override
  String get pWhatsAppOk => 'वर्गाच्या लिंक WhatsApp वर पाठवा';

  @override
  String get pNeedTerms => 'पुढे जाण्यासाठी अटी आणि गोपनीयता धोरण स्वीकारा';

  @override
  String get pContinue => 'पुढे';

  @override
  String get pCreateAccount => 'तुमचे विद्यार्थी खाते तयार करा';

  @override
  String get pHaveAccount => 'आधीच खाते आहे? लॉग इन करा';

  @override
  String get pNewHere => 'नवीन आहात? खाते तयार करा';

  @override
  String get pEnrollSend => 'प्रवेश विनंती पाठवा';

  @override
  String pEnrollSent(String teacher) {
    return 'विनंती पाठवली. $teacher मंजूर केल्यावर तुम्हाला कळवले जाईल.';
  }

  @override
  String get pLoginToEnroll => 'प्रवेशासाठी लॉग इन करा किंवा खाते तयार करा.';

  @override
  String get pOpenVideo => 'व्हिडिओ चालवा';

  @override
  String get pCreate => 'खाते तयार करा';

  @override
  String get sWatchOffline => 'ऑफलाइन पाहा';

  @override
  String get sNeedCourse => 'अभ्यासक्रम निवडा';

  @override
  String get sDemoTitle => 'थेट डेमो विनंती';

  @override
  String get sVideoDone => 'व्हिडिओ संपला';

  @override
  String get sSave => 'जतन करा';

  @override
  String get sLiveUpcoming => 'आगामी';

  @override
  String get sLiveNow => 'आता लाइव्ह';

  @override
  String get sLiveEnded => 'संपला';

  @override
  String get sLiveRecorded => 'रेकॉर्ड केलेला';

  @override
  String get sLiveCancelled => 'रद्द';

  @override
  String get sLiveJoin => 'वर्गात सामील व्हा';

  @override
  String get sLiveRecordingSoon => 'रेकॉर्डिंग लवकरच येईल';

  @override
  String sLiveStartsAt(String when) {
    return 'सुरुवात $when';
  }

  @override
  String get sLiveCancelledText => 'हा वर्ग रद्द झाला आहे.';

  @override
  String get sLiveJoinOpens => 'वर्गाच्या 10 मिनिटे आधी सामील व्हा बटण दिसेल.';

  @override
  String get sLiveJoinSoon => 'वर्गाच्या 10 मिनिटे आधी सामील होता येईल';

  @override
  String get tAddMeetLink => 'Meet लिंक जोडा';

  @override
  String get tMeetLinkLabel => 'Google Meet लिंक';

  @override
  String get tMeetLinkHint =>
      'meet.google.com उघडा, मीटिंग तयार करा आणि तिची लिंक इथे पेस्ट करा.';

  @override
  String get tSaveLink => 'लिंक जतन करा';

  @override
  String get sLiveWaitingForLink => 'शिक्षक लवकरच लिंक देतील';
}
