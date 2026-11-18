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

  @override
  String get tRequests => 'Requests';

  @override
  String get tStudents => 'Students';

  @override
  String get tClasses => 'Classes';

  @override
  String get tDoubts => 'Doubts';

  @override
  String get tDemoWaiting => 'Demo requests waiting';

  @override
  String get tEnrollWaiting => 'Students waiting to enroll';

  @override
  String get tOpenDoubts => 'Open doubts';

  @override
  String get tActiveStudents => 'Active students';

  @override
  String get tToday => 'Today\'s live classes';

  @override
  String get tNoClasses => 'No live classes';

  @override
  String get tClassesOnWeb =>
      'Schedule classes on the website; they appear here.';

  @override
  String get tDemoTab => 'Live demos';

  @override
  String get tEnrollTab => 'Enrollments';

  @override
  String get tNoDemos => 'No demo requests';

  @override
  String get tNoEnrollments => 'No students waiting';

  @override
  String get tNoStudents => 'No students yet';

  @override
  String get tNoDoubts => 'No open doubts';

  @override
  String get join => 'Join';

  @override
  String get schedule => 'Schedule';

  @override
  String get reschedule => 'Change time';

  @override
  String get sendWhatsApp => 'Send on WhatsApp';

  @override
  String get waSent => 'Sent ✓';

  @override
  String get waNotSent => 'WhatsApp message not sent';

  @override
  String get approve => 'Approve';

  @override
  String get approveStudent => 'Approve student';

  @override
  String approveTitle(String name) {
    return 'Approve $name';
  }

  @override
  String get approvedMsg => 'Student approved';

  @override
  String get batch => 'Batch';

  @override
  String get startDate => 'Start';

  @override
  String get endDate => 'End';

  @override
  String get needBatch => 'Choose a batch';

  @override
  String get needDates => 'Choose the start and end dates';

  @override
  String get dateOrder => 'End date must be on or after start date';

  @override
  String get needWhen => 'Choose the date and time';

  @override
  String get minReason => 'Write at least 5 characters';

  @override
  String get requiredField => 'This field is required';

  @override
  String accessUntil(String date) {
    return 'Access until $date';
  }

  @override
  String get attendance => 'Attendance';

  @override
  String get markAllPresent => 'Mark all present';

  @override
  String presentCount(int present, int total) {
    return '$present of $total present';
  }

  @override
  String get present => 'Present';

  @override
  String get absent => 'Absent';

  @override
  String get saveAttendance => 'Save attendance';

  @override
  String get saved => 'Saved';

  @override
  String get reply => 'Reply';

  @override
  String replyTo(String name) {
    return 'Reply to $name';
  }

  @override
  String get yourReply => 'Your reply';

  @override
  String get sendReply => 'Send reply';

  @override
  String get replySent => 'Reply sent';

  @override
  String get cancel => 'Cancel';

  @override
  String get tryAgain => 'Try again';

  @override
  String get sHome => 'Home';

  @override
  String get sExams => 'Exams';

  @override
  String get sClasses => 'Classes';

  @override
  String get sDoubts => 'Doubts';

  @override
  String get sMore => 'More';

  @override
  String get sNextUp => 'Next up';

  @override
  String get sContinue => 'Continue';

  @override
  String get sMyCourses => 'My courses';

  @override
  String get sNoCourses => 'You\'re not enrolled in any course yet.';

  @override
  String get sBrowse => 'Browse courses';

  @override
  String sUntil(String date) {
    return 'Access until $date';
  }

  @override
  String get sReadOnly =>
      'Your teacher\'s account is inactive. You can still open lessons you completed.';

  @override
  String get sUpcoming => 'Upcoming live classes';

  @override
  String get sNoUpcoming => 'No upcoming live classes';

  @override
  String get sRequests => 'Requests you sent';

  @override
  String get sLessons => 'Lessons';

  @override
  String get sMarkComplete => 'Mark as complete';

  @override
  String get sCompleted => 'Completed';

  @override
  String get sOpenNotes => 'Open notes';

  @override
  String get sOpenLink => 'Open link';

  @override
  String get sWatchOnSite => 'Watch video';

  @override
  String get sNoLessons => 'No lessons yet';

  @override
  String get sLocked => 'Locked';

  @override
  String get sDownload => 'Download';

  @override
  String get sDownloaded => 'Downloaded';

  @override
  String sDownloading(String pct) {
    return 'Downloading $pct%';
  }

  @override
  String get sPaused => 'Paused';

  @override
  String get sQueued => 'Waiting…';

  @override
  String get sWaitingWifi => 'Waiting for Wi-Fi';

  @override
  String sNotEnoughSpace(String mb) {
    return 'Not enough space. Free up $mb MB';
  }

  @override
  String get sDeviceLimit =>
      'Downloads are allowed on 2 devices. Remove one in Profile → Downloads.';

  @override
  String get sDownloadFailed => 'Download failed. Try again.';

  @override
  String get sLicenseExpired =>
      'Connect to the internet to keep watching offline';

  @override
  String sRemoved(String title, String reason) {
    return 'Removed: $title ($reason)';
  }

  @override
  String get sReasonSubscription => 'subscription ended';

  @override
  String get sReasonTeacher => 'teacher inactive';

  @override
  String get sReasonPaused => 'access paused';

  @override
  String get sReasonDevice => 'device removed';

  @override
  String get sReasonOther => 'no longer available';

  @override
  String get sDownloads => 'Downloads';

  @override
  String get sNoDownloads => 'No downloaded videos';

  @override
  String sStorageUsed(String size) {
    return 'Using $size on this phone';
  }

  @override
  String get sWifiOnly => 'Download on Wi-Fi only';

  @override
  String get sDeleteAll => 'Delete all';

  @override
  String get sDelete => 'Delete';

  @override
  String get sPause => 'Pause';

  @override
  String get sResume => 'Resume';

  @override
  String sExpires(String date) {
    return 'Watch offline until $date';
  }

  @override
  String get sDevices => 'Devices with downloads';

  @override
  String get sRemove => 'Remove';

  @override
  String get sThisDevice => 'This phone';

  @override
  String get sChooseCourse => 'Choose a course';

  @override
  String get sStart => 'Start';

  @override
  String get sResumeExam => 'Resume';

  @override
  String get sFinalLocked => 'Finish all Unit Tests to unlock the Final Exam.';

  @override
  String get sNoAttempts => 'No attempts left';

  @override
  String sAttemptsLeft(String n) {
    return 'Attempts left: $n';
  }

  @override
  String sBest(String pct) {
    return 'Best: $pct%';
  }

  @override
  String get sViewResult => 'View result';

  @override
  String get sNoExams => 'No exams yet';

  @override
  String sQuestionN(String n) {
    return 'Question $n';
  }

  @override
  String get sYourAnswer => 'Your answer';

  @override
  String sAnswered(String n, int total) {
    return '$n of $total answered';
  }

  @override
  String get sSaving => 'Saving…';

  @override
  String get sSaved => 'Saved';

  @override
  String get sOffline => 'Offline — answers will sync';

  @override
  String get sSubmit => 'Submit exam';

  @override
  String get sSubmitTitle => 'Submit the exam?';

  @override
  String sSubmitBody(String n, int total) {
    return 'You answered $n of $total questions. You can\'t change answers after submitting.';
  }

  @override
  String get sKeepGoing => 'Keep answering';

  @override
  String get sSubmitNow => 'Submit now';

  @override
  String get sCorrect => 'Correct';

  @override
  String get sWrong => 'Not correct';

  @override
  String sTimeLeft(String time) {
    return 'Time left $time';
  }

  @override
  String get sResult => 'Result';

  @override
  String sRank(String rank, String of) {
    return 'Rank $rank of $of';
  }

  @override
  String get sPassed => 'Passed';

  @override
  String get sFailed => 'Not passed';

  @override
  String get sAuto => 'Submitted automatically when time ran out';

  @override
  String get sReview => 'Answer review';

  @override
  String get sCorrectAnswer => 'Correct answer';

  @override
  String get sNotAnswered => 'Not answered';

  @override
  String get sAskDoubt => 'Ask a doubt';

  @override
  String get sQuestion => 'Your question';

  @override
  String get sSendToTeacher => 'Send to teacher';

  @override
  String get sDoubtSent => 'Doubt sent to your teacher';

  @override
  String get sNoDoubts => 'You haven\'t asked any doubts yet';

  @override
  String get sWaitingReply => 'Waiting for the teacher\'s reply';

  @override
  String get sProgress => 'Progress';

  @override
  String sLessonsDone(String done, int total) {
    return '$done of $total lessons completed';
  }

  @override
  String sAttendance(String pct, String attended, String held) {
    return 'Attendance: $pct% ($attended of $held classes)';
  }

  @override
  String get sProfile => 'Profile';

  @override
  String get sName => 'Name';

  @override
  String get sEducation => 'Education';

  @override
  String get sClass => 'Class / standard';

  @override
  String get sCity => 'City';

  @override
  String get sEmail => 'Email';

  @override
  String get sLanguage => 'Language';

  @override
  String get sNotifications => 'Notifications';

  @override
  String get sNoNotifications => 'No notifications';

  @override
  String get sMarkAllRead => 'Mark all as read';

  @override
  String get sLiveClasses => 'Live classes';

  @override
  String sOptional(String label) {
    return '$label (optional)';
  }

  @override
  String get pCourses => 'Courses';

  @override
  String get pSearch => 'Search courses';

  @override
  String get pNoResults => 'No courses match your search';

  @override
  String pBy(String teacher) {
    return 'by $teacher';
  }

  @override
  String get pDemoVideos => 'Demo videos';

  @override
  String get pCurriculum => 'What you\'ll learn';

  @override
  String get pBatches => 'Batches';

  @override
  String get pRequestDemo => 'Request a live demo';

  @override
  String get pEnroll => 'Enroll now';

  @override
  String get pDemoSent =>
      'Request sent. The teacher will message you with the demo time.';

  @override
  String get pPreferredTime => 'Preferred time';

  @override
  String get pMessage => 'Message';

  @override
  String get pAcceptTerms => 'I accept the Terms and Privacy Policy';

  @override
  String get pWhatsAppOk => 'Send me class links on WhatsApp';

  @override
  String get pNeedTerms => 'Accept the Terms and Privacy Policy to continue';

  @override
  String get pContinue => 'Continue';

  @override
  String get pCreateAccount => 'Create your student account';

  @override
  String get pHaveAccount => 'Already have an account? Log in';

  @override
  String get pNewHere => 'New here? Create an account';

  @override
  String get pEnrollSend => 'Send enrollment request';

  @override
  String pEnrollSent(String teacher) {
    return 'Request sent. You\'ll be notified when $teacher approves it.';
  }

  @override
  String get pLoginToEnroll => 'Log in or create an account to enroll.';

  @override
  String get pOpenVideo => 'Play video';

  @override
  String get pCreate => 'Create account';

  @override
  String get sWatchOffline => 'Watch offline';

  @override
  String get sNeedCourse => 'Choose a course';

  @override
  String get sDemoTitle => 'Live demo request';

  @override
  String get sVideoDone => 'Video finished';

  @override
  String get sSave => 'Save';

  @override
  String get sLiveUpcoming => 'Upcoming';

  @override
  String get sLiveNow => 'Live now';

  @override
  String get sLiveEnded => 'Ended';

  @override
  String get sLiveRecorded => 'Recorded';

  @override
  String get sLiveCancelled => 'Cancelled';

  @override
  String get sLiveJoin => 'Join class';

  @override
  String get sLiveRecordingSoon => 'Recording coming soon';

  @override
  String sLiveStartsAt(String when) {
    return 'Starts $when';
  }

  @override
  String get sLiveCancelledText => 'This class was cancelled.';

  @override
  String get sLiveJoinOpens =>
      'The Join button appears 10 minutes before the class.';

  @override
  String get sLiveJoinSoon => 'Join opens 10 min before';

  @override
  String get tAddMeetLink => 'Add Meet link';

  @override
  String get tMeetLinkLabel => 'Google Meet link';

  @override
  String get tMeetLinkHint =>
      'Open meet.google.com, create a meeting and paste its link here.';

  @override
  String get tSaveLink => 'Save link';

  @override
  String get sLiveWaitingForLink => 'The teacher will share the link soon';
}
