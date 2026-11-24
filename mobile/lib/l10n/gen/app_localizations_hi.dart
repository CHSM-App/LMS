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
  String get loginWelcome => 'वापस स्वागत है';

  @override
  String get loginTerms =>
      'आगे बढ़ने पर आप शर्तों और गोपनीयता नीति से सहमत हैं।';

  @override
  String loginStep(int n, int total) {
    return 'चरण $n / $total';
  }

  @override
  String get loginStepMobile => 'मोबाइल नंबर';

  @override
  String get loginStepVerify => 'OTP जाँचें';

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

  @override
  String get sHome => 'होम';

  @override
  String get sExams => 'परीक्षाएँ';

  @override
  String get sClasses => 'क्लास';

  @override
  String get sDoubts => 'संदेह';

  @override
  String get sMore => 'और';

  @override
  String get sNextUp => 'अगला';

  @override
  String get sContinue => 'जारी रखें';

  @override
  String get sMyCourses => 'मेरे कोर्स';

  @override
  String get sNoCourses => 'आपने अभी किसी कोर्स में नामांकन नहीं किया है।';

  @override
  String get sBrowse => 'कोर्स देखें';

  @override
  String sUntil(String date) {
    return '$date तक एक्सेस';
  }

  @override
  String get sReadOnly =>
      'आपके शिक्षक का खाता निष्क्रिय है। आप पूरे किए गए पाठ अब भी खोल सकते हैं।';

  @override
  String get sUpcoming => 'आगामी लाइव क्लास';

  @override
  String get sNoUpcoming => 'कोई आगामी लाइव क्लास नहीं';

  @override
  String get sRequests => 'आपके भेजे अनुरोध';

  @override
  String get sLessons => 'पाठ';

  @override
  String get sMarkComplete => 'पूरा हुआ चिह्नित करें';

  @override
  String get sCompleted => 'पूरा';

  @override
  String get sOpenNotes => 'नोट्स खोलें';

  @override
  String get sOpenLink => 'लिंक खोलें';

  @override
  String get sWatchOnSite => 'वीडियो देखें';

  @override
  String get sNoLessons => 'अभी कोई पाठ नहीं';

  @override
  String get sLocked => 'बंद';

  @override
  String get sDownload => 'डाउनलोड';

  @override
  String get sDownloaded => 'डाउनलोड हो गया';

  @override
  String sDownloading(String pct) {
    return 'डाउनलोड हो रहा है $pct%';
  }

  @override
  String get sPaused => 'रोका गया';

  @override
  String get sQueued => 'प्रतीक्षा में…';

  @override
  String get sWaitingWifi => 'Wi-Fi की प्रतीक्षा';

  @override
  String sNotEnoughSpace(String mb) {
    return 'पर्याप्त जगह नहीं है। $mb MB जगह खाली करें';
  }

  @override
  String get sDeviceLimit =>
      'डाउनलोड 2 डिवाइस पर ही चलते हैं। प्रोफ़ाइल → डाउनलोड में से एक हटाएँ।';

  @override
  String get sDownloadFailed => 'डाउनलोड नहीं हुआ। फिर से कोशिश करें।';

  @override
  String get sLicenseExpired => 'ऑफ़लाइन देखते रहने के लिए इंटरनेट से जुड़ें';

  @override
  String sRemoved(String title, String reason) {
    return 'हटाया गया: $title ($reason)';
  }

  @override
  String get sReasonSubscription => 'सदस्यता समाप्त';

  @override
  String get sReasonTeacher => 'शिक्षक निष्क्रिय';

  @override
  String get sReasonPaused => 'एक्सेस रोका गया';

  @override
  String get sReasonDevice => 'डिवाइस हटाया गया';

  @override
  String get sReasonOther => 'अब उपलब्ध नहीं';

  @override
  String get sDownloads => 'डाउनलोड';

  @override
  String get sNoDownloads => 'कोई डाउनलोड किया गया वीडियो नहीं';

  @override
  String sStorageUsed(String size) {
    return 'इस फ़ोन पर $size उपयोग में';
  }

  @override
  String get sWifiOnly => 'केवल Wi-Fi पर डाउनलोड करें';

  @override
  String get sDeleteAll => 'सब हटाएँ';

  @override
  String get sDelete => 'हटाएँ';

  @override
  String get sPause => 'रोकें';

  @override
  String get sResume => 'फिर शुरू करें';

  @override
  String sExpires(String date) {
    return '$date तक ऑफ़लाइन देखें';
  }

  @override
  String get sDevices => 'डाउनलोड वाले डिवाइस';

  @override
  String get sRemove => 'हटाएँ';

  @override
  String get sThisDevice => 'यह फ़ोन';

  @override
  String get sChooseCourse => 'कोर्स चुनें';

  @override
  String get sStart => 'शुरू करें';

  @override
  String get sResumeExam => 'जारी रखें';

  @override
  String get sFinalLocked =>
      'अंतिम परीक्षा खोलने के लिए सभी यूनिट टेस्ट पूरे करें।';

  @override
  String get sNoAttempts => 'कोई प्रयास शेष नहीं';

  @override
  String sAttemptsLeft(String n) {
    return 'शेष प्रयास: $n';
  }

  @override
  String sBest(String pct) {
    return 'सर्वश्रेष्ठ: $pct%';
  }

  @override
  String get sViewResult => 'परिणाम देखें';

  @override
  String get sNoExams => 'अभी कोई परीक्षा नहीं';

  @override
  String sQuestionN(String n) {
    return 'प्रश्न $n';
  }

  @override
  String get sYourAnswer => 'आपका उत्तर';

  @override
  String sAnswered(String n, int total) {
    return '$total में से $n उत्तर दिए';
  }

  @override
  String get sSaving => 'सहेजा जा रहा है…';

  @override
  String get sSaved => 'सहेजा गया';

  @override
  String get sOffline => 'ऑफ़लाइन — उत्तर बाद में भेजे जाएँगे';

  @override
  String get sSubmit => 'परीक्षा सबमिट करें';

  @override
  String get sSubmitTitle => 'परीक्षा सबमिट करें?';

  @override
  String sSubmitBody(String n, int total) {
    return 'आपने $total में से $n प्रश्नों के उत्तर दिए। सबमिट के बाद उत्तर नहीं बदल सकेंगे।';
  }

  @override
  String get sKeepGoing => 'उत्तर देते रहें';

  @override
  String get sSubmitNow => 'अभी सबमिट करें';

  @override
  String get sCorrect => 'सही';

  @override
  String get sWrong => 'गलत';

  @override
  String sTimeLeft(String time) {
    return 'बचा समय $time';
  }

  @override
  String get sResult => 'परिणाम';

  @override
  String sRank(String rank, String of) {
    return '$of में से रैंक $rank';
  }

  @override
  String get sPassed => 'उत्तीर्ण';

  @override
  String get sFailed => 'अनुत्तीर्ण';

  @override
  String get sAuto => 'समय खत्म होने पर अपने-आप सबमिट हुआ';

  @override
  String get sReview => 'उत्तर समीक्षा';

  @override
  String get sSolutionImage => 'हल की फ़ोटो';

  @override
  String get sCorrectAnswer => 'सही उत्तर';

  @override
  String get sNotAnswered => 'उत्तर नहीं दिया';

  @override
  String get sAskDoubt => 'संदेह पूछें';

  @override
  String get sQuestion => 'आपका प्रश्न';

  @override
  String get sSendToTeacher => 'शिक्षक को भेजें';

  @override
  String get sDoubtSent => 'संदेह शिक्षक को भेजा गया';

  @override
  String get sNoDoubts => 'आपने अभी कोई संदेह नहीं पूछा';

  @override
  String get sWaitingReply => 'शिक्षक के उत्तर की प्रतीक्षा';

  @override
  String get sProgress => 'प्रगति';

  @override
  String sLessonsDone(String done, int total) {
    return '$total में से $done पाठ पूरे';
  }

  @override
  String sAttendance(String pct, String attended, String held) {
    return 'उपस्थिति: $pct% ($held में से $attended क्लास)';
  }

  @override
  String get sProfile => 'प्रोफ़ाइल';

  @override
  String get sName => 'नाम';

  @override
  String get sEducation => 'शिक्षा';

  @override
  String get sClass => 'कक्षा';

  @override
  String get sCity => 'शहर';

  @override
  String get sEmail => 'ईमेल';

  @override
  String get sLanguage => 'भाषा';

  @override
  String get sNotifications => 'सूचनाएँ';

  @override
  String get sNoNotifications => 'कोई सूचना नहीं';

  @override
  String get sMarkAllRead => 'सभी को पढ़ा हुआ चिह्नित करें';

  @override
  String get sLiveClasses => 'लाइव क्लास';

  @override
  String sOptional(String label) {
    return '$label (वैकल्पिक)';
  }

  @override
  String get pCourses => 'कोर्स';

  @override
  String get pSearch => 'कोर्स खोजें';

  @override
  String get pNoResults => 'आपकी खोज से कोई कोर्स नहीं मिला';

  @override
  String get pNoResultsHint =>
      'कोई दूसरा शब्द आज़माएँ, या सभी कोर्स देखने के लिए खोज मिटाएँ।';

  @override
  String get pClearSearch => 'खोज मिटाएँ';

  @override
  String get pAll => 'सभी विषय';

  @override
  String get pAllLanguages => 'सभी भाषाएँ';

  @override
  String get pFreeDemo => 'मुफ़्त लाइव डेमो';

  @override
  String get pDemoBadge => 'मुफ़्त डेमो';

  @override
  String pResultCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count कोर्स',
      one: '1 कोर्स',
    );
    return '$_temp0';
  }

  @override
  String get pLangEn => 'अंग्रेज़ी';

  @override
  String get pLangMr => 'मराठी';

  @override
  String get pLangHi => 'हिंदी';

  @override
  String pBy(String teacher) {
    return '$teacher द्वारा';
  }

  @override
  String get pDemoVideos => 'डेमो वीडियो';

  @override
  String get pCurriculum => 'आप क्या सीखेंगे';

  @override
  String get pBatches => 'बैच';

  @override
  String get pRequestDemo => 'लाइव डेमो का अनुरोध करें';

  @override
  String get pEnroll => 'अभी नामांकन करें';

  @override
  String get pDemoSent => 'अनुरोध भेजा गया। शिक्षक डेमो का समय आपको बताएँगे।';

  @override
  String get pPreferredTime => 'पसंद का समय';

  @override
  String get pMessage => 'संदेश';

  @override
  String get pAcceptTerms => 'मैं नियम और गोपनीयता नीति स्वीकार करता/करती हूँ';

  @override
  String get pWhatsAppOk => 'क्लास के लिंक WhatsApp पर भेजें';

  @override
  String get pNeedTerms =>
      'आगे बढ़ने के लिए नियम और गोपनीयता नीति स्वीकार करें';

  @override
  String get pContinue => 'आगे';

  @override
  String get pCreateAccount => 'अपना छात्र खाता बनाएँ';

  @override
  String get pHaveAccount => 'पहले से खाता है? लॉग इन करें';

  @override
  String get pNewHere => 'नए हैं? खाता बनाएँ';

  @override
  String get pEnrollSend => 'नामांकन अनुरोध भेजें';

  @override
  String pEnrollSent(String teacher) {
    return 'अनुरोध भेजा गया। $teacher के स्वीकार करने पर आपको सूचित किया जाएगा।';
  }

  @override
  String get pLoginToEnroll => 'नामांकन के लिए लॉग इन करें या खाता बनाएँ।';

  @override
  String get pOpenVideo => 'वीडियो चलाएँ';

  @override
  String get pCreate => 'खाता बनाएँ';

  @override
  String get sWatchOffline => 'ऑफ़लाइन देखें';

  @override
  String get sNeedCourse => 'कोर्स चुनें';

  @override
  String get sDemoTitle => 'लाइव डेमो अनुरोध';

  @override
  String get sVideoDone => 'वीडियो समाप्त';

  @override
  String get sSave => 'सहेजें';

  @override
  String get sLiveUpcoming => 'आने वाली';

  @override
  String get sLiveNow => 'अभी लाइव';

  @override
  String get sLiveEnded => 'समाप्त';

  @override
  String get sLiveRecorded => 'रिकॉर्ड की गई';

  @override
  String get sLiveCancelled => 'रद्द';

  @override
  String get sLiveJoin => 'क्लास में जुड़ें';

  @override
  String get sLiveRecordingSoon => 'रिकॉर्डिंग जल्द आएगी';

  @override
  String sLiveStartsAt(String when) {
    return 'शुरुआत $when';
  }

  @override
  String get sLiveCancelledText => 'यह क्लास रद्द हो गई है।';

  @override
  String get sLiveJoinOpens => 'क्लास से 10 मिनट पहले जुड़ें बटन दिखेगा।';

  @override
  String get sLiveJoinSoon => 'क्लास से 10 मिनट पहले जुड़ सकेंगे';

  @override
  String get tAddMeetLink => 'Meet लिंक जोड़ें';

  @override
  String get tMeetLinkLabel => 'Google Meet लिंक';

  @override
  String get tMeetLinkHint =>
      'meet.google.com खोलें, मीटिंग बनाएँ और उसका लिंक यहाँ पेस्ट करें।';

  @override
  String get tSaveLink => 'लिंक सहेजें';

  @override
  String get sLiveWaitingForLink => 'शिक्षक जल्द ही लिंक देंगे';

  @override
  String get sLiveUnscheduled => 'अभी समय तय नहीं';

  @override
  String get sLiveScheduleSoon => 'समय जल्द बताया जाएगा';

  @override
  String get tLiveSchedule => 'लाइव शेड्यूल';

  @override
  String get tLiveScheduleIntro =>
      'इस बैच के लिए हर लाइव पाठ की तारीख तय करें। बाद में तय करनी हो तो पाठ खाली छोड़ें।';

  @override
  String get tLiveScheduleEmpty => 'इस कोर्स में अभी कोई लाइव पाठ नहीं है';

  @override
  String get tLiveScheduleSave => 'शेड्यूल सेव करें';

  @override
  String get tLiveScheduleNothing => 'कम से कम एक पाठ की तारीख भरें';

  @override
  String get tSetDate => 'तारीख तय करें';

  @override
  String get tChooseCourse => 'कोर्स';

  @override
  String get tChooseBatch => 'बैच';

  @override
  String get tOpenSchedule => 'शेड्यूल खोलें';
}
