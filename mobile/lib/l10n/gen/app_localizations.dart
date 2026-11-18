import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_mr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
    Locale('mr'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'LMS'**
  String get appName;

  /// No description provided for @appTagline.
  ///
  /// In en, this message translates to:
  /// **'Learn from teachers you trust'**
  String get appTagline;

  /// No description provided for @loginTitle.
  ///
  /// In en, this message translates to:
  /// **'Log in'**
  String get loginTitle;

  /// No description provided for @loginIntro.
  ///
  /// In en, this message translates to:
  /// **'Use your mobile number. We\'ll send you a one-time password.'**
  String get loginIntro;

  /// No description provided for @mobileNumber.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get mobileNumber;

  /// No description provided for @mobileHint.
  ///
  /// In en, this message translates to:
  /// **'10-digit mobile number'**
  String get mobileHint;

  /// No description provided for @invalidMobile.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 10-digit mobile number'**
  String get invalidMobile;

  /// No description provided for @sendOtp.
  ///
  /// In en, this message translates to:
  /// **'Send OTP'**
  String get sendOtp;

  /// No description provided for @otpSentTo.
  ///
  /// In en, this message translates to:
  /// **'OTP sent to {mobile}.'**
  String otpSentTo(String mobile);

  /// No description provided for @changeNumber.
  ///
  /// In en, this message translates to:
  /// **'Change number'**
  String get changeNumber;

  /// No description provided for @verifyLogin.
  ///
  /// In en, this message translates to:
  /// **'Verify and log in'**
  String get verifyLogin;

  /// No description provided for @resendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend OTP in {s}s'**
  String resendIn(int s);

  /// No description provided for @resendOtp.
  ///
  /// In en, this message translates to:
  /// **'Resend OTP'**
  String get resendOtp;

  /// No description provided for @adminWebOnly.
  ///
  /// In en, this message translates to:
  /// **'Admin tools are on the website. Log in there to manage teachers.'**
  String get adminWebOnly;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logout;

  /// No description provided for @dashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// No description provided for @account.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get account;

  /// No description provided for @hello.
  ///
  /// In en, this message translates to:
  /// **'Hello, {name}'**
  String hello(String name);

  /// No description provided for @changeMobile.
  ///
  /// In en, this message translates to:
  /// **'Change mobile number'**
  String get changeMobile;

  /// No description provided for @newMobile.
  ///
  /// In en, this message translates to:
  /// **'New mobile number'**
  String get newMobile;

  /// No description provided for @mobileChanged.
  ///
  /// In en, this message translates to:
  /// **'Mobile number changed'**
  String get mobileChanged;

  /// No description provided for @deleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete my account'**
  String get deleteAccount;

  /// No description provided for @deleteAccountIntro.
  ///
  /// In en, this message translates to:
  /// **'This removes your name, mobile number, email and photo. Your teacher keeps exam and attendance records as \"Deleted user\". This can\'t be undone.'**
  String get deleteAccountIntro;

  /// No description provided for @accountDeleted.
  ///
  /// In en, this message translates to:
  /// **'Your account was deleted'**
  String get accountDeleted;

  /// No description provided for @tRequests.
  ///
  /// In en, this message translates to:
  /// **'Requests'**
  String get tRequests;

  /// No description provided for @tStudents.
  ///
  /// In en, this message translates to:
  /// **'Students'**
  String get tStudents;

  /// No description provided for @tClasses.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get tClasses;

  /// No description provided for @tDoubts.
  ///
  /// In en, this message translates to:
  /// **'Doubts'**
  String get tDoubts;

  /// No description provided for @tDemoWaiting.
  ///
  /// In en, this message translates to:
  /// **'Demo requests waiting'**
  String get tDemoWaiting;

  /// No description provided for @tEnrollWaiting.
  ///
  /// In en, this message translates to:
  /// **'Students waiting to enroll'**
  String get tEnrollWaiting;

  /// No description provided for @tOpenDoubts.
  ///
  /// In en, this message translates to:
  /// **'Open doubts'**
  String get tOpenDoubts;

  /// No description provided for @tActiveStudents.
  ///
  /// In en, this message translates to:
  /// **'Active students'**
  String get tActiveStudents;

  /// No description provided for @tToday.
  ///
  /// In en, this message translates to:
  /// **'Today\'s live classes'**
  String get tToday;

  /// No description provided for @tNoClasses.
  ///
  /// In en, this message translates to:
  /// **'No live classes'**
  String get tNoClasses;

  /// No description provided for @tClassesOnWeb.
  ///
  /// In en, this message translates to:
  /// **'Schedule classes on the website; they appear here.'**
  String get tClassesOnWeb;

  /// No description provided for @tDemoTab.
  ///
  /// In en, this message translates to:
  /// **'Live demos'**
  String get tDemoTab;

  /// No description provided for @tEnrollTab.
  ///
  /// In en, this message translates to:
  /// **'Enrollments'**
  String get tEnrollTab;

  /// No description provided for @tNoDemos.
  ///
  /// In en, this message translates to:
  /// **'No demo requests'**
  String get tNoDemos;

  /// No description provided for @tNoEnrollments.
  ///
  /// In en, this message translates to:
  /// **'No students waiting'**
  String get tNoEnrollments;

  /// No description provided for @tNoStudents.
  ///
  /// In en, this message translates to:
  /// **'No students yet'**
  String get tNoStudents;

  /// No description provided for @tNoDoubts.
  ///
  /// In en, this message translates to:
  /// **'No open doubts'**
  String get tNoDoubts;

  /// No description provided for @join.
  ///
  /// In en, this message translates to:
  /// **'Join'**
  String get join;

  /// No description provided for @schedule.
  ///
  /// In en, this message translates to:
  /// **'Schedule'**
  String get schedule;

  /// No description provided for @reschedule.
  ///
  /// In en, this message translates to:
  /// **'Change time'**
  String get reschedule;

  /// No description provided for @sendWhatsApp.
  ///
  /// In en, this message translates to:
  /// **'Send on WhatsApp'**
  String get sendWhatsApp;

  /// No description provided for @waSent.
  ///
  /// In en, this message translates to:
  /// **'Sent ✓'**
  String get waSent;

  /// No description provided for @waNotSent.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp message not sent'**
  String get waNotSent;

  /// No description provided for @approve.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get approve;

  /// No description provided for @approveStudent.
  ///
  /// In en, this message translates to:
  /// **'Approve student'**
  String get approveStudent;

  /// No description provided for @approveTitle.
  ///
  /// In en, this message translates to:
  /// **'Approve {name}'**
  String approveTitle(String name);

  /// No description provided for @approvedMsg.
  ///
  /// In en, this message translates to:
  /// **'Student approved'**
  String get approvedMsg;

  /// No description provided for @batch.
  ///
  /// In en, this message translates to:
  /// **'Batch'**
  String get batch;

  /// No description provided for @startDate.
  ///
  /// In en, this message translates to:
  /// **'Start'**
  String get startDate;

  /// No description provided for @endDate.
  ///
  /// In en, this message translates to:
  /// **'End'**
  String get endDate;

  /// No description provided for @needBatch.
  ///
  /// In en, this message translates to:
  /// **'Choose a batch'**
  String get needBatch;

  /// No description provided for @needDates.
  ///
  /// In en, this message translates to:
  /// **'Choose the start and end dates'**
  String get needDates;

  /// No description provided for @dateOrder.
  ///
  /// In en, this message translates to:
  /// **'End date must be on or after start date'**
  String get dateOrder;

  /// No description provided for @needWhen.
  ///
  /// In en, this message translates to:
  /// **'Choose the date and time'**
  String get needWhen;

  /// No description provided for @minReason.
  ///
  /// In en, this message translates to:
  /// **'Write at least 5 characters'**
  String get minReason;

  /// No description provided for @requiredField.
  ///
  /// In en, this message translates to:
  /// **'This field is required'**
  String get requiredField;

  /// No description provided for @accessUntil.
  ///
  /// In en, this message translates to:
  /// **'Access until {date}'**
  String accessUntil(String date);

  /// No description provided for @attendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get attendance;

  /// No description provided for @markAllPresent.
  ///
  /// In en, this message translates to:
  /// **'Mark all present'**
  String get markAllPresent;

  /// No description provided for @presentCount.
  ///
  /// In en, this message translates to:
  /// **'{present} of {total} present'**
  String presentCount(int present, int total);

  /// No description provided for @present.
  ///
  /// In en, this message translates to:
  /// **'Present'**
  String get present;

  /// No description provided for @absent.
  ///
  /// In en, this message translates to:
  /// **'Absent'**
  String get absent;

  /// No description provided for @saveAttendance.
  ///
  /// In en, this message translates to:
  /// **'Save attendance'**
  String get saveAttendance;

  /// No description provided for @saved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get saved;

  /// No description provided for @reply.
  ///
  /// In en, this message translates to:
  /// **'Reply'**
  String get reply;

  /// No description provided for @replyTo.
  ///
  /// In en, this message translates to:
  /// **'Reply to {name}'**
  String replyTo(String name);

  /// No description provided for @yourReply.
  ///
  /// In en, this message translates to:
  /// **'Your reply'**
  String get yourReply;

  /// No description provided for @sendReply.
  ///
  /// In en, this message translates to:
  /// **'Send reply'**
  String get sendReply;

  /// No description provided for @replySent.
  ///
  /// In en, this message translates to:
  /// **'Reply sent'**
  String get replySent;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get tryAgain;

  /// No description provided for @sHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get sHome;

  /// No description provided for @sExams.
  ///
  /// In en, this message translates to:
  /// **'Exams'**
  String get sExams;

  /// No description provided for @sClasses.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get sClasses;

  /// No description provided for @sDoubts.
  ///
  /// In en, this message translates to:
  /// **'Doubts'**
  String get sDoubts;

  /// No description provided for @sMore.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get sMore;

  /// No description provided for @sNextUp.
  ///
  /// In en, this message translates to:
  /// **'Next up'**
  String get sNextUp;

  /// No description provided for @sContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get sContinue;

  /// No description provided for @sMyCourses.
  ///
  /// In en, this message translates to:
  /// **'My courses'**
  String get sMyCourses;

  /// No description provided for @sNoCourses.
  ///
  /// In en, this message translates to:
  /// **'You\'re not enrolled in any course yet.'**
  String get sNoCourses;

  /// No description provided for @sBrowse.
  ///
  /// In en, this message translates to:
  /// **'Browse courses'**
  String get sBrowse;

  /// No description provided for @sUntil.
  ///
  /// In en, this message translates to:
  /// **'Access until {date}'**
  String sUntil(String date);

  /// No description provided for @sReadOnly.
  ///
  /// In en, this message translates to:
  /// **'Your teacher\'s account is inactive. You can still open lessons you completed.'**
  String get sReadOnly;

  /// No description provided for @sUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming live classes'**
  String get sUpcoming;

  /// No description provided for @sNoUpcoming.
  ///
  /// In en, this message translates to:
  /// **'No upcoming live classes'**
  String get sNoUpcoming;

  /// No description provided for @sRequests.
  ///
  /// In en, this message translates to:
  /// **'Requests you sent'**
  String get sRequests;

  /// No description provided for @sLessons.
  ///
  /// In en, this message translates to:
  /// **'Lessons'**
  String get sLessons;

  /// No description provided for @sMarkComplete.
  ///
  /// In en, this message translates to:
  /// **'Mark as complete'**
  String get sMarkComplete;

  /// No description provided for @sCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get sCompleted;

  /// No description provided for @sOpenNotes.
  ///
  /// In en, this message translates to:
  /// **'Open notes'**
  String get sOpenNotes;

  /// No description provided for @sOpenLink.
  ///
  /// In en, this message translates to:
  /// **'Open link'**
  String get sOpenLink;

  /// No description provided for @sWatchOnSite.
  ///
  /// In en, this message translates to:
  /// **'Watch video'**
  String get sWatchOnSite;

  /// No description provided for @sNoLessons.
  ///
  /// In en, this message translates to:
  /// **'No lessons yet'**
  String get sNoLessons;

  /// No description provided for @sLocked.
  ///
  /// In en, this message translates to:
  /// **'Locked'**
  String get sLocked;

  /// No description provided for @sDownload.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get sDownload;

  /// No description provided for @sDownloaded.
  ///
  /// In en, this message translates to:
  /// **'Downloaded'**
  String get sDownloaded;

  /// No description provided for @sDownloading.
  ///
  /// In en, this message translates to:
  /// **'Downloading {pct}%'**
  String sDownloading(String pct);

  /// No description provided for @sPaused.
  ///
  /// In en, this message translates to:
  /// **'Paused'**
  String get sPaused;

  /// No description provided for @sQueued.
  ///
  /// In en, this message translates to:
  /// **'Waiting…'**
  String get sQueued;

  /// No description provided for @sWaitingWifi.
  ///
  /// In en, this message translates to:
  /// **'Waiting for Wi-Fi'**
  String get sWaitingWifi;

  /// No description provided for @sNotEnoughSpace.
  ///
  /// In en, this message translates to:
  /// **'Not enough space. Free up {mb} MB'**
  String sNotEnoughSpace(String mb);

  /// No description provided for @sDeviceLimit.
  ///
  /// In en, this message translates to:
  /// **'Downloads are allowed on 2 devices. Remove one in Profile → Downloads.'**
  String get sDeviceLimit;

  /// No description provided for @sDownloadFailed.
  ///
  /// In en, this message translates to:
  /// **'Download failed. Try again.'**
  String get sDownloadFailed;

  /// No description provided for @sLicenseExpired.
  ///
  /// In en, this message translates to:
  /// **'Connect to the internet to keep watching offline'**
  String get sLicenseExpired;

  /// No description provided for @sRemoved.
  ///
  /// In en, this message translates to:
  /// **'Removed: {title} ({reason})'**
  String sRemoved(String title, String reason);

  /// No description provided for @sReasonSubscription.
  ///
  /// In en, this message translates to:
  /// **'subscription ended'**
  String get sReasonSubscription;

  /// No description provided for @sReasonTeacher.
  ///
  /// In en, this message translates to:
  /// **'teacher inactive'**
  String get sReasonTeacher;

  /// No description provided for @sReasonPaused.
  ///
  /// In en, this message translates to:
  /// **'access paused'**
  String get sReasonPaused;

  /// No description provided for @sReasonDevice.
  ///
  /// In en, this message translates to:
  /// **'device removed'**
  String get sReasonDevice;

  /// No description provided for @sReasonOther.
  ///
  /// In en, this message translates to:
  /// **'no longer available'**
  String get sReasonOther;

  /// No description provided for @sDownloads.
  ///
  /// In en, this message translates to:
  /// **'Downloads'**
  String get sDownloads;

  /// No description provided for @sNoDownloads.
  ///
  /// In en, this message translates to:
  /// **'No downloaded videos'**
  String get sNoDownloads;

  /// No description provided for @sStorageUsed.
  ///
  /// In en, this message translates to:
  /// **'Using {size} on this phone'**
  String sStorageUsed(String size);

  /// No description provided for @sWifiOnly.
  ///
  /// In en, this message translates to:
  /// **'Download on Wi-Fi only'**
  String get sWifiOnly;

  /// No description provided for @sDeleteAll.
  ///
  /// In en, this message translates to:
  /// **'Delete all'**
  String get sDeleteAll;

  /// No description provided for @sDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get sDelete;

  /// No description provided for @sPause.
  ///
  /// In en, this message translates to:
  /// **'Pause'**
  String get sPause;

  /// No description provided for @sResume.
  ///
  /// In en, this message translates to:
  /// **'Resume'**
  String get sResume;

  /// No description provided for @sExpires.
  ///
  /// In en, this message translates to:
  /// **'Watch offline until {date}'**
  String sExpires(String date);

  /// No description provided for @sDevices.
  ///
  /// In en, this message translates to:
  /// **'Devices with downloads'**
  String get sDevices;

  /// No description provided for @sRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get sRemove;

  /// No description provided for @sThisDevice.
  ///
  /// In en, this message translates to:
  /// **'This phone'**
  String get sThisDevice;

  /// No description provided for @sChooseCourse.
  ///
  /// In en, this message translates to:
  /// **'Choose a course'**
  String get sChooseCourse;

  /// No description provided for @sStart.
  ///
  /// In en, this message translates to:
  /// **'Start'**
  String get sStart;

  /// No description provided for @sResumeExam.
  ///
  /// In en, this message translates to:
  /// **'Resume'**
  String get sResumeExam;

  /// No description provided for @sFinalLocked.
  ///
  /// In en, this message translates to:
  /// **'Finish all Unit Tests to unlock the Final Exam.'**
  String get sFinalLocked;

  /// No description provided for @sNoAttempts.
  ///
  /// In en, this message translates to:
  /// **'No attempts left'**
  String get sNoAttempts;

  /// No description provided for @sAttemptsLeft.
  ///
  /// In en, this message translates to:
  /// **'Attempts left: {n}'**
  String sAttemptsLeft(String n);

  /// No description provided for @sBest.
  ///
  /// In en, this message translates to:
  /// **'Best: {pct}%'**
  String sBest(String pct);

  /// No description provided for @sViewResult.
  ///
  /// In en, this message translates to:
  /// **'View result'**
  String get sViewResult;

  /// No description provided for @sNoExams.
  ///
  /// In en, this message translates to:
  /// **'No exams yet'**
  String get sNoExams;

  /// No description provided for @sQuestionN.
  ///
  /// In en, this message translates to:
  /// **'Question {n}'**
  String sQuestionN(String n);

  /// No description provided for @sYourAnswer.
  ///
  /// In en, this message translates to:
  /// **'Your answer'**
  String get sYourAnswer;

  /// No description provided for @sAnswered.
  ///
  /// In en, this message translates to:
  /// **'{n} of {total} answered'**
  String sAnswered(String n, int total);

  /// No description provided for @sSaving.
  ///
  /// In en, this message translates to:
  /// **'Saving…'**
  String get sSaving;

  /// No description provided for @sSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get sSaved;

  /// No description provided for @sOffline.
  ///
  /// In en, this message translates to:
  /// **'Offline — answers will sync'**
  String get sOffline;

  /// No description provided for @sSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit exam'**
  String get sSubmit;

  /// No description provided for @sSubmitTitle.
  ///
  /// In en, this message translates to:
  /// **'Submit the exam?'**
  String get sSubmitTitle;

  /// No description provided for @sSubmitBody.
  ///
  /// In en, this message translates to:
  /// **'You answered {n} of {total} questions. You can\'t change answers after submitting.'**
  String sSubmitBody(String n, int total);

  /// No description provided for @sKeepGoing.
  ///
  /// In en, this message translates to:
  /// **'Keep answering'**
  String get sKeepGoing;

  /// No description provided for @sSubmitNow.
  ///
  /// In en, this message translates to:
  /// **'Submit now'**
  String get sSubmitNow;

  /// No description provided for @sCorrect.
  ///
  /// In en, this message translates to:
  /// **'Correct'**
  String get sCorrect;

  /// No description provided for @sWrong.
  ///
  /// In en, this message translates to:
  /// **'Not correct'**
  String get sWrong;

  /// No description provided for @sTimeLeft.
  ///
  /// In en, this message translates to:
  /// **'Time left {time}'**
  String sTimeLeft(String time);

  /// No description provided for @sResult.
  ///
  /// In en, this message translates to:
  /// **'Result'**
  String get sResult;

  /// No description provided for @sRank.
  ///
  /// In en, this message translates to:
  /// **'Rank {rank} of {of}'**
  String sRank(String rank, String of);

  /// No description provided for @sPassed.
  ///
  /// In en, this message translates to:
  /// **'Passed'**
  String get sPassed;

  /// No description provided for @sFailed.
  ///
  /// In en, this message translates to:
  /// **'Not passed'**
  String get sFailed;

  /// No description provided for @sAuto.
  ///
  /// In en, this message translates to:
  /// **'Submitted automatically when time ran out'**
  String get sAuto;

  /// No description provided for @sReview.
  ///
  /// In en, this message translates to:
  /// **'Answer review'**
  String get sReview;

  /// No description provided for @sCorrectAnswer.
  ///
  /// In en, this message translates to:
  /// **'Correct answer'**
  String get sCorrectAnswer;

  /// No description provided for @sNotAnswered.
  ///
  /// In en, this message translates to:
  /// **'Not answered'**
  String get sNotAnswered;

  /// No description provided for @sAskDoubt.
  ///
  /// In en, this message translates to:
  /// **'Ask a doubt'**
  String get sAskDoubt;

  /// No description provided for @sQuestion.
  ///
  /// In en, this message translates to:
  /// **'Your question'**
  String get sQuestion;

  /// No description provided for @sSendToTeacher.
  ///
  /// In en, this message translates to:
  /// **'Send to teacher'**
  String get sSendToTeacher;

  /// No description provided for @sDoubtSent.
  ///
  /// In en, this message translates to:
  /// **'Doubt sent to your teacher'**
  String get sDoubtSent;

  /// No description provided for @sNoDoubts.
  ///
  /// In en, this message translates to:
  /// **'You haven\'t asked any doubts yet'**
  String get sNoDoubts;

  /// No description provided for @sWaitingReply.
  ///
  /// In en, this message translates to:
  /// **'Waiting for the teacher\'s reply'**
  String get sWaitingReply;

  /// No description provided for @sProgress.
  ///
  /// In en, this message translates to:
  /// **'Progress'**
  String get sProgress;

  /// No description provided for @sLessonsDone.
  ///
  /// In en, this message translates to:
  /// **'{done} of {total} lessons completed'**
  String sLessonsDone(String done, int total);

  /// No description provided for @sAttendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance: {pct}% ({attended} of {held} classes)'**
  String sAttendance(String pct, String attended, String held);

  /// No description provided for @sProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get sProfile;

  /// No description provided for @sName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get sName;

  /// No description provided for @sEducation.
  ///
  /// In en, this message translates to:
  /// **'Education'**
  String get sEducation;

  /// No description provided for @sClass.
  ///
  /// In en, this message translates to:
  /// **'Class / standard'**
  String get sClass;

  /// No description provided for @sCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get sCity;

  /// No description provided for @sEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get sEmail;

  /// No description provided for @sLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get sLanguage;

  /// No description provided for @sNotifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get sNotifications;

  /// No description provided for @sNoNotifications.
  ///
  /// In en, this message translates to:
  /// **'No notifications'**
  String get sNoNotifications;

  /// No description provided for @sMarkAllRead.
  ///
  /// In en, this message translates to:
  /// **'Mark all as read'**
  String get sMarkAllRead;

  /// No description provided for @sLiveClasses.
  ///
  /// In en, this message translates to:
  /// **'Live classes'**
  String get sLiveClasses;

  /// No description provided for @sOptional.
  ///
  /// In en, this message translates to:
  /// **'{label} (optional)'**
  String sOptional(String label);

  /// No description provided for @pCourses.
  ///
  /// In en, this message translates to:
  /// **'Courses'**
  String get pCourses;

  /// No description provided for @pSearch.
  ///
  /// In en, this message translates to:
  /// **'Search courses'**
  String get pSearch;

  /// No description provided for @pNoResults.
  ///
  /// In en, this message translates to:
  /// **'No courses match your search'**
  String get pNoResults;

  /// No description provided for @pBy.
  ///
  /// In en, this message translates to:
  /// **'by {teacher}'**
  String pBy(String teacher);

  /// No description provided for @pDemoVideos.
  ///
  /// In en, this message translates to:
  /// **'Demo videos'**
  String get pDemoVideos;

  /// No description provided for @pCurriculum.
  ///
  /// In en, this message translates to:
  /// **'What you\'ll learn'**
  String get pCurriculum;

  /// No description provided for @pBatches.
  ///
  /// In en, this message translates to:
  /// **'Batches'**
  String get pBatches;

  /// No description provided for @pRequestDemo.
  ///
  /// In en, this message translates to:
  /// **'Request a live demo'**
  String get pRequestDemo;

  /// No description provided for @pEnroll.
  ///
  /// In en, this message translates to:
  /// **'Enroll now'**
  String get pEnroll;

  /// No description provided for @pDemoSent.
  ///
  /// In en, this message translates to:
  /// **'Request sent. The teacher will message you with the demo time.'**
  String get pDemoSent;

  /// No description provided for @pPreferredTime.
  ///
  /// In en, this message translates to:
  /// **'Preferred time'**
  String get pPreferredTime;

  /// No description provided for @pMessage.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get pMessage;

  /// No description provided for @pAcceptTerms.
  ///
  /// In en, this message translates to:
  /// **'I accept the Terms and Privacy Policy'**
  String get pAcceptTerms;

  /// No description provided for @pWhatsAppOk.
  ///
  /// In en, this message translates to:
  /// **'Send me class links on WhatsApp'**
  String get pWhatsAppOk;

  /// No description provided for @pNeedTerms.
  ///
  /// In en, this message translates to:
  /// **'Accept the Terms and Privacy Policy to continue'**
  String get pNeedTerms;

  /// No description provided for @pContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get pContinue;

  /// No description provided for @pCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create your student account'**
  String get pCreateAccount;

  /// No description provided for @pHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Log in'**
  String get pHaveAccount;

  /// No description provided for @pNewHere.
  ///
  /// In en, this message translates to:
  /// **'New here? Create an account'**
  String get pNewHere;

  /// No description provided for @pEnrollSend.
  ///
  /// In en, this message translates to:
  /// **'Send enrollment request'**
  String get pEnrollSend;

  /// No description provided for @pEnrollSent.
  ///
  /// In en, this message translates to:
  /// **'Request sent. You\'ll be notified when {teacher} approves it.'**
  String pEnrollSent(String teacher);

  /// No description provided for @pLoginToEnroll.
  ///
  /// In en, this message translates to:
  /// **'Log in or create an account to enroll.'**
  String get pLoginToEnroll;

  /// No description provided for @pOpenVideo.
  ///
  /// In en, this message translates to:
  /// **'Play video'**
  String get pOpenVideo;

  /// No description provided for @pCreate.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get pCreate;

  /// No description provided for @sWatchOffline.
  ///
  /// In en, this message translates to:
  /// **'Watch offline'**
  String get sWatchOffline;

  /// No description provided for @sNeedCourse.
  ///
  /// In en, this message translates to:
  /// **'Choose a course'**
  String get sNeedCourse;

  /// No description provided for @sDemoTitle.
  ///
  /// In en, this message translates to:
  /// **'Live demo request'**
  String get sDemoTitle;

  /// No description provided for @sVideoDone.
  ///
  /// In en, this message translates to:
  /// **'Video finished'**
  String get sVideoDone;

  /// No description provided for @sSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get sSave;

  /// No description provided for @sLiveUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get sLiveUpcoming;

  /// No description provided for @sLiveNow.
  ///
  /// In en, this message translates to:
  /// **'Live now'**
  String get sLiveNow;

  /// No description provided for @sLiveEnded.
  ///
  /// In en, this message translates to:
  /// **'Ended'**
  String get sLiveEnded;

  /// No description provided for @sLiveRecorded.
  ///
  /// In en, this message translates to:
  /// **'Recorded'**
  String get sLiveRecorded;

  /// No description provided for @sLiveCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get sLiveCancelled;

  /// No description provided for @sLiveJoin.
  ///
  /// In en, this message translates to:
  /// **'Join class'**
  String get sLiveJoin;

  /// No description provided for @sLiveRecordingSoon.
  ///
  /// In en, this message translates to:
  /// **'Recording coming soon'**
  String get sLiveRecordingSoon;

  /// No description provided for @sLiveStartsAt.
  ///
  /// In en, this message translates to:
  /// **'Starts {when}'**
  String sLiveStartsAt(String when);

  /// No description provided for @sLiveCancelledText.
  ///
  /// In en, this message translates to:
  /// **'This class was cancelled.'**
  String get sLiveCancelledText;

  /// No description provided for @sLiveJoinOpens.
  ///
  /// In en, this message translates to:
  /// **'The Join button appears 10 minutes before the class.'**
  String get sLiveJoinOpens;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi', 'mr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'hi':
      return AppLocalizationsHi();
    case 'mr':
      return AppLocalizationsMr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
