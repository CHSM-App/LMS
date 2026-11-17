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
