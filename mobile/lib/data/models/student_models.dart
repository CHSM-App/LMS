import 'package:flutter/foundation.dart';

/// Hand-written models for the student + public API (no codegen).
typedef Json = Map<String, dynamic>;

DateTime? _date(dynamic v) => v == null ? null : DateTime.parse(v as String).toUtc();
List<Json> _list(dynamic v) => ((v as List?) ?? const []).cast<Json>();
int _int(dynamic v) => (v as num?)?.toInt() ?? 0;
double _num(dynamic v) => (v as num?)?.toDouble() ?? 0;

// ---------- Public catalog ----------
@immutable
class CourseCard {
  const CourseCard({required this.slug, required this.title, required this.teacherName, this.subject, this.language, this.thumbnailUrl, this.durationText, this.feeDisplay});
  final String slug;
  final String title;
  final String teacherName;
  final String? subject;
  final String? language;
  final String? thumbnailUrl;
  final String? durationText;
  final String? feeDisplay;

  factory CourseCard.fromJson(Json j) => CourseCard(
        slug: j['slug'] as String,
        title: j['title'] as String,
        teacherName: ((j['teacher'] as Json?)?['name'] ?? '') as String,
        subject: j['subject'] as String?,
        language: j['language'] as String?,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        durationText: j['durationText'] as String?,
        feeDisplay: j['feeDisplay'] as String?,
      );
}

@immutable
class VideoRef {
  const VideoRef({required this.source, required this.url});
  final String source; // upload | youtube | vimeo | bunny
  final String url;
  bool get isUpload => source == 'upload';
  factory VideoRef.fromJson(Json j) => VideoRef(source: j['source'] as String, url: j['url'] as String);
}

@immutable
class CourseDetail {
  const CourseDetail({required this.slug, required this.title, required this.teacherName, this.description, this.durationText, this.feeDisplay, this.thumbnailUrl, this.demoVideos = const [], this.batches = const [], this.curriculum = const []});
  final String slug;
  final String title;
  final String teacherName;
  final String? description;
  final String? durationText;
  final String? feeDisplay;
  final String? thumbnailUrl;
  final List<VideoRef> demoVideos;
  final List<String> batches;
  final List<({String name, List<String> modules})> curriculum;

  factory CourseDetail.fromJson(Json j) => CourseDetail(
        slug: j['slug'] as String,
        title: j['title'] as String,
        teacherName: ((j['teacher'] as Json?)?['name'] ?? '') as String,
        description: j['description'] as String?,
        durationText: j['durationText'] as String?,
        feeDisplay: j['feeDisplay'] as String?,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        demoVideos: _list(j['demoVideos']).map(VideoRef.fromJson).toList(),
        batches: _list(j['batches']).map((b) => [b['name'], b['timingText']].whereType<String>().join(' · ')).toList(),
        curriculum: _list(j['curriculum']).map((s) => (name: s['name'] as String, modules: _list(s['modules']).map((m) => m['name'] as String).toList())).toList(),
      );
}

// ---------- Dashboard ----------
@immutable
class MyCourse {
  const MyCourse({required this.courseId, required this.title, required this.teacher, required this.progressPct, required this.accessStatus, this.batch, this.endDate, this.readOnly = false});
  final int courseId;
  final String title;
  final String teacher;
  final String? batch;
  final double progressPct;
  final String? endDate;
  final String accessStatus;
  final bool readOnly;

  factory MyCourse.fromJson(Json j) => MyCourse(
        courseId: _int(j['courseId']),
        title: j['title'] as String,
        teacher: (j['teacher'] ?? '') as String,
        batch: j['batch'] as String?,
        progressPct: _num(j['progressPct']),
        endDate: j['endDate'] as String?,
        accessStatus: (j['accessStatus'] ?? 'active') as String,
        readOnly: j['readOnly'] == true,
      );
}

@immutable
class LiveClassItem {
  const LiveClassItem({required this.id, required this.topic, required this.course, required this.startsAt, this.meetLink, this.canJoin = false, this.batch, this.durationMin = 60});
  final int id;
  final String topic;
  final String course;
  final String? batch;
  final DateTime startsAt;
  final int durationMin;

  /// Sent by the API only during the join window (10 min before start until the end).
  final String? meetLink;
  final bool canJoin;

  factory LiveClassItem.fromJson(Json j) => LiveClassItem(
        id: _int(j['id']),
        topic: j['topic'] as String,
        course: (j['course'] ?? '') as String,
        batch: j['batch'] as String?,
        startsAt: _date(j['startsAt'])!,
        durationMin: _int(j['durationMin']),
        meetLink: j['meetLink'] as String?,
        canJoin: j['canJoin'] == true && j['meetLink'] != null,
      );
}

@immutable
class EnrollmentRequestItem {
  const EnrollmentRequestItem({required this.id, required this.courseTitle, required this.status, this.rejectReason});
  final int id;
  final String courseTitle;
  final String status;
  final String? rejectReason;
  factory EnrollmentRequestItem.fromJson(Json j) =>
      EnrollmentRequestItem(id: _int(j['id']), courseTitle: ((j['course'] as Json?)?['title'] ?? '') as String, status: j['status'] as String, rejectReason: j['rejectReason'] as String?);
}

@immutable
class StudentDashboard {
  const StudentDashboard({this.myCourses = const [], this.upcomingLiveClasses = const [], this.requests = const []});
  final List<MyCourse> myCourses;
  final List<LiveClassItem> upcomingLiveClasses;
  final List<EnrollmentRequestItem> requests;

  /// The course to continue: active, writable and not finished.
  MyCourse? get nextUp {
    for (final c in myCourses) {
      if (!c.readOnly && c.accessStatus == 'active' && c.progressPct < 100) return c;
    }
    return null;
  }

  factory StudentDashboard.fromJson(Json j) => StudentDashboard(
        myCourses: _list(j['myCourses']).map(MyCourse.fromJson).toList(),
        upcomingLiveClasses: _list(j['upcomingLiveClasses']).map(LiveClassItem.fromJson).toList(),
        requests: _list(j['requests']).map(EnrollmentRequestItem.fromJson).toList(),
      );
}

// ---------- Player ----------
/// Schedule and stage of a live lesson. Stage: upcoming | live | ended | recorded | cancelled.
/// The Meet link is sent by the API only while the lesson is upcoming or live.
@immutable
class LessonLive {
  const LessonLive({required this.startsAt, required this.durationMin, required this.stage, this.meetLink});
  final DateTime startsAt;
  final int durationMin;
  final String stage;
  final String? meetLink;

  static LessonLive? fromJson(dynamic j) {
    if (j is! Map) return null;
    return LessonLive(
      startsAt: DateTime.parse(j['startsAt'] as String),
      durationMin: _int(j['durationMin']),
      stage: j['stage'] as String,
      meetLink: j['meetLink'] as String?,
    );
  }
}

@immutable
class Lesson {
  const Lesson({required this.id, required this.title, required this.type, this.videoSource, this.completed = false, this.locked = false, this.downloadable = false, this.live});
  final int id;
  final String title;
  final String type; // video | pdf | link | live
  final String? videoSource;
  final bool completed;
  final bool locked;
  final bool downloadable;
  final LessonLive? live;

  factory Lesson.fromJson(Json j) => Lesson(
        id: _int(j['id']),
        title: j['title'] as String,
        type: j['type'] as String,
        videoSource: j['videoSource'] as String?,
        completed: j['completed'] == true,
        locked: j['locked'] == true,
        downloadable: j['downloadable'] == true,
        live: LessonLive.fromJson(j['live']),
      );
}

@immutable
class CourseModule {
  const CourseModule({required this.id, required this.name, required this.lessons});
  final int id;
  final String name;
  final List<Lesson> lessons;
}

@immutable
class CourseSubject {
  const CourseSubject({required this.id, required this.name, required this.modules});
  final int id;
  final String name;
  final List<CourseModule> modules;
}

@immutable
class CourseView {
  const CourseView({required this.courseId, required this.title, required this.progressPct, required this.subjects, this.readOnly = false});
  final int courseId;
  final String title;
  final double progressPct;
  final bool readOnly;
  final List<CourseSubject> subjects;

  List<Lesson> get lessons => [for (final s in subjects) for (final m in s.modules) ...m.lessons];

  factory CourseView.fromJson(Json j) => CourseView(
        courseId: _int(j['courseId']),
        title: j['title'] as String,
        progressPct: _num(j['progressPct']),
        readOnly: j['readOnly'] == true,
        subjects: _list(j['subjects'])
            .map((s) => CourseSubject(
                  id: _int(s['id']),
                  name: s['name'] as String,
                  modules: _list(s['modules']).map((m) => CourseModule(id: _int(m['id']), name: m['name'] as String, lessons: _list(m['contents']).map(Lesson.fromJson).toList())).toList(),
                ))
            .toList(),
      );
}

@immutable
class LessonDetail {
  const LessonDetail({required this.id, required this.courseId, required this.title, required this.type, this.videoSource, this.url, this.lastPositionSec = 0, this.completed = false, this.downloadable = false, this.canComplete = true, this.live});
  final int id;
  final int courseId;
  final String title;
  final String type;
  final String? videoSource;
  final String? url;
  final int lastPositionSec;
  final bool completed;
  final bool downloadable;

  /// False for a live lesson until it has ended or has a recording.
  final bool canComplete;
  final LessonLive? live;

  factory LessonDetail.fromJson(Json j) => LessonDetail(
        id: _int(j['id']),
        courseId: _int(j['courseId']),
        title: j['title'] as String,
        type: j['type'] as String,
        videoSource: j['videoSource'] as String?,
        url: j['url'] as String?,
        lastPositionSec: _int(j['lastPositionSec']),
        completed: j['completed'] == true,
        downloadable: j['downloadable'] == true,
        canComplete: j['canComplete'] != false,
        live: LessonLive.fromJson(j['live']),
      );
}

// ---------- Exams ----------
@immutable
class ExamCard {
  const ExamCard({required this.id, required this.title, required this.category, required this.mode, this.timeLimitMin, this.locked = false, this.attemptsLeft, this.openAttemptId, this.lastAttemptId, this.bestPct});
  final int id;
  final String title;
  final String category;
  final String mode;
  final int? timeLimitMin;
  final bool locked;
  final int? attemptsLeft;
  final String? openAttemptId;
  final String? lastAttemptId;
  final double? bestPct;

  bool get canStart => !locked && (openAttemptId != null || attemptsLeft != 0);

  factory ExamCard.fromJson(Json j) => ExamCard(
        id: _int(j['id']),
        title: j['title'] as String,
        category: j['category'] as String,
        mode: j['mode'] as String,
        timeLimitMin: (j['timeLimitMin'] as num?)?.toInt(),
        locked: j['locked'] == true,
        attemptsLeft: (j['attemptsLeft'] as num?)?.toInt(),
        openAttemptId: j['openAttemptId'] as String?,
        lastAttemptId: j['lastAttemptId'] as String?,
        bestPct: (j['best'] as Json?) == null ? null : _num((j['best'] as Json)['pct']),
      );
}

@immutable
class ExamOption {
  const ExamOption(this.id, this.text);
  final int id;
  final String text;
}

@immutable
class ExamQuestion {
  const ExamQuestion({required this.id, required this.type, required this.text, required this.marks, this.options = const []});
  final int id;
  final String type; // mcq | true_false | multi_correct | fill_blank
  final String text;
  final num marks;
  final List<ExamOption> options;

  factory ExamQuestion.fromJson(Json j) => ExamQuestion(
        id: _int(j['id']),
        type: j['type'] as String,
        text: j['text'] as String,
        marks: (j['marks'] as num?) ?? 1,
        options: _list(j['options']).map((o) => ExamOption(_int(o['id']), o['text'] as String)).toList(),
      );
}

@immutable
class ExamPaper {
  const ExamPaper({required this.attemptId, required this.examId, required this.title, required this.mode, required this.questions, this.deadlineAt, this.answers = const {}});
  final String attemptId;
  final int examId;
  final String title;
  final String mode;
  final DateTime? deadlineAt;
  final List<ExamQuestion> questions;
  final Map<int, Json> answers;

  factory ExamPaper.fromJson(Json j) => ExamPaper(
        attemptId: j['attemptId'] as String,
        examId: _int(j['examId']),
        title: j['title'] as String,
        mode: j['mode'] as String,
        deadlineAt: _date(j['deadlineAt']),
        questions: _list(j['questions']).map(ExamQuestion.fromJson).toList(),
        answers: ((j['answers'] as Json?) ?? const {}).map((k, v) => MapEntry(int.parse(k), (v as Map).cast<String, dynamic>())),
      );
}

@immutable
class PracticeFeedback {
  const PracticeFeedback({required this.correct, this.explanation});
  final bool correct;
  final String? explanation;
}

@immutable
class ReviewItem {
  const ReviewItem({required this.text, required this.correct, required this.marks, required this.yourAnswer, required this.correctAnswer, this.explanation});
  final String text;
  final bool correct;
  final num marks;
  final String yourAnswer;
  final String correctAnswer;
  final String? explanation;
}

@immutable
class AttemptResult {
  const AttemptResult({required this.title, required this.score, required this.max, required this.pct, this.passed, this.rank, this.of, this.autoSubmitted = false, this.review = const []});
  final String title;
  final num score;
  final num max;
  final double pct;
  final bool? passed;
  final int? rank;
  final int? of;
  final bool autoSubmitted;
  final List<ReviewItem> review;

  factory AttemptResult.fromJson(Json j) {
    String optionText(Json q, List ids) => _list(q['options']).where((o) => ids.contains(o['id'])).map((o) => o['text']).join(', ');
    String answerText(Json q, Json? a) {
      if (a == null) return '';
      if (a.containsKey('text')) return (a['text'] ?? '') as String;
      return optionText(q, (a['optionIds'] as List?) ?? [a['optionId']]);
    }

    return AttemptResult(
      title: ((j['exam'] as Json?)?['title'] ?? '') as String,
      score: (j['score'] as num?) ?? 0,
      max: (j['max'] as num?) ?? 0,
      pct: _num(j['pct']),
      passed: j['passed'] as bool?,
      rank: (j['rank'] as num?)?.toInt(),
      of: (j['of'] as num?)?.toInt(),
      autoSubmitted: j['autoSubmitted'] == true,
      review: _list(j['review']).map((q) {
        final ca = (q['correctAnswer'] as Json?) ?? const {};
        return ReviewItem(
          text: q['text'] as String,
          correct: q['correct'] == true,
          marks: (q['marks'] as num?) ?? 0,
          yourAnswer: answerText(q, q['yourAnswer'] as Json?),
          correctAnswer: ca['acceptedAnswers'] != null ? (ca['acceptedAnswers'] as List).join(' / ') : optionText(q, (ca['optionIds'] as List?) ?? const []),
          explanation: q['explanation'] as String?,
        );
      }).toList(),
    );
  }
}

// ---------- Doubts, progress, profile ----------
@immutable
class StudentDoubt {
  const StudentDoubt({required this.id, required this.courseTitle, required this.question, required this.status, required this.createdAt, this.reply});
  final int id;
  final String courseTitle;
  final String question;
  final String status;
  final DateTime createdAt;
  final String? reply;

  factory StudentDoubt.fromJson(Json j) => StudentDoubt(
        id: _int(j['id']),
        courseTitle: ((j['course'] as Json?)?['title'] ?? '') as String,
        question: j['question'] as String,
        status: j['status'] as String,
        createdAt: _date(j['createdAt'])!,
        reply: j['reply'] as String?,
      );
}

@immutable
class CourseProgress {
  const CourseProgress({required this.courseId, required this.title, required this.progressPct, required this.completedLessons, required this.totalLessons, required this.attendancePct, required this.classesAttended, required this.classesHeld});
  final int courseId;
  final String title;
  final double progressPct;
  final int completedLessons;
  final int totalLessons;
  final double attendancePct;
  final int classesAttended;
  final int classesHeld;

  factory CourseProgress.fromJson(Json j) => CourseProgress(
        courseId: _int(j['courseId']),
        title: j['title'] as String,
        progressPct: _num(j['progressPct']),
        completedLessons: _int(j['completedLessons']),
        totalLessons: _int(j['totalLessons']),
        attendancePct: _num(j['attendancePct']),
        classesAttended: _int(j['classesAttended']),
        classesHeld: _int(j['classesHeld']),
      );
}

@immutable
class StudentProfile {
  const StudentProfile({required this.name, required this.mobile, this.education, this.classStandard, this.city, this.email, this.preferredLang = 'en'});
  final String name;
  final String mobile;
  final String? education;
  final String? classStandard;
  final String? city;
  final String? email;
  final String preferredLang;

  factory StudentProfile.fromJson(Json j) => StudentProfile(
        name: j['name'] as String,
        mobile: j['mobile'] as String,
        education: j['education'] as String?,
        classStandard: j['classStandard'] as String?,
        city: j['city'] as String?,
        email: j['email'] as String?,
        preferredLang: (j['preferredLang'] ?? 'en') as String,
      );

  Json toJson() => {'name': name, 'education': education, 'classStandard': classStandard, 'city': city, 'email': email, 'preferredLang': preferredLang};
}

@immutable
class AppNotification {
  const AppNotification({required this.id, required this.title, required this.message, required this.createdAt, this.isRead = false});
  final int id;
  final String title;
  final String message;
  final DateTime createdAt;
  final bool isRead;

  factory AppNotification.fromJson(Json j) => AppNotification(
        id: _int(j['id']),
        title: j['title'] as String,
        message: (j['message'] ?? '') as String,
        createdAt: _date(j['createdAt'])!,
        isRead: j['isRead'] == true || j['readAt'] != null,
      );
}

// ---------- Offline downloads ----------
@immutable
class DownloadTicket {
  const DownloadTicket({required this.contentId, required this.title, required this.downloadUrl, required this.keyId, required this.key, required this.licenseExpiresAt, this.sizeBytes});
  final int contentId;
  final String title;
  final String downloadUrl;
  final String keyId;
  final String key; // base64, 32 bytes
  final DateTime licenseExpiresAt;
  final int? sizeBytes;

  factory DownloadTicket.fromJson(Json j) => DownloadTicket(
        contentId: _int(j['contentId']),
        title: j['title'] as String,
        downloadUrl: j['downloadUrl'] as String,
        keyId: j['keyId'] as String,
        key: j['key'] as String,
        licenseExpiresAt: _date(j['licenseExpiresAt'])!,
        sizeBytes: (j['sizeBytes'] as num?)?.toInt(),
      );
}

@immutable
class RenewResult {
  const RenewResult({required this.contentId, this.licenseExpiresAt, this.revokedReason});
  final int contentId;
  final DateTime? licenseExpiresAt;
  final String? revokedReason; // subscription_ended | teacher_inactive | access_paused | device_removed | not_found ...
  bool get revoked => revokedReason != null;

  factory RenewResult.fromJson(Json j) => RenewResult(
        contentId: _int(j['contentId']),
        licenseExpiresAt: _date(j['licenseExpiresAt']),
        revokedReason: j['revoked'] == true ? (j['reason'] ?? 'revoked') as String : null,
      );
}

@immutable
class RegisteredDevice {
  const RegisteredDevice({required this.deviceId, this.deviceName, this.platform, this.downloads = 0});
  final String deviceId;
  final String? deviceName;
  final String? platform;
  final int downloads;
  factory RegisteredDevice.fromJson(Json j) =>
      RegisteredDevice(deviceId: j['deviceId'] as String, deviceName: j['deviceName'] as String?, platform: j['platform'] as String?, downloads: _int(j['downloads']));
}
