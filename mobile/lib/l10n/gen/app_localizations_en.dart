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
}
