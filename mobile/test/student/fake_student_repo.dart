import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/data/models/student_models.dart';
import 'package:lms_app/data/repositories/student_repository.dart';

const offline = ApiException(0, "You're offline. Check your connection and try again.", 'NETWORK');

/// In-memory student repository for viewmodel and widget tests.
class FakeStudentRepo implements StudentRepository {
  FakeStudentRepo({this.paper});

  ExamPaper? paper;
  final saved = <String>[]; // "qid:answer" in send order
  int saveFailures = 0; // next N saveAnswer calls fail as offline
  ApiException? saveError;
  int submits = 0;
  final progressCalls = <Json>[];
  final synced = <List<Json>>[];
  bool syncFails = false;
  List<RenewResult> renewResults = [];
  DownloadTicket? ticket;
  ApiException? issueError;
  final registered = <String>[];
  CourseView? courseView;

  @override
  Future<ExamPaper> startAttempt(int examId) async => paper!;

  @override
  Future<PracticeFeedback?> saveAnswer(String attemptId, int questionId, Json answer) async {
    if (saveError != null) throw saveError!;
    if (saveFailures > 0) {
      saveFailures--;
      throw offline;
    }
    saved.add('$questionId:${answer.values.first}');
    if (paper?.mode == 'practice') return const PracticeFeedback(correct: true, explanation: 'Because 2+2=4');
    return null;
  }

  @override
  Future<void> submit(String attemptId) async => submits++;

  @override
  Future<StudentDashboard> dashboard() async => StudentDashboard.fromJson({
        'myCourses': [
          {'courseId': 3, 'title': 'Maths', 'teacher': 'Suresh', 'batch': 'Morning', 'progressPct': 40, 'accessStatus': 'active', 'endDate': '2099-12-31'},
          {'courseId': 4, 'title': 'Science', 'teacher': 'Kavita', 'progressPct': 10, 'accessStatus': 'active', 'readOnly': true},
        ],
        'upcomingLiveClasses': [],
        'requests': [],
      });

  @override
  Future<CourseView> course(int courseId) async => courseView!;

  @override
  Future<void> saveProgress(int contentId, {int? positionSec, bool? completed}) async =>
      progressCalls.add({'contentId': contentId, 'positionSec': ?positionSec, 'completed': ?completed});

  @override
  Future<void> syncProgress(List<Json> items) async {
    if (syncFails) throw offline;
    synced.add(items);
  }

  @override
  Future<void> registerDevice(String deviceId, String deviceName, String platform) async => registered.add(deviceId);

  @override
  Future<DownloadTicket> issueDownload(int contentId, String deviceId) async {
    if (issueError != null) throw issueError!;
    return ticket!;
  }

  @override
  Future<List<RenewResult>> renew(String deviceId, List<int> contentIds) async {
    renewCalls++;
    if (renewFails) throw offline;
    return renewResults;
  }

  // ---- screens ----
  List<ExamCard> examCards = const [];
  AttemptResult? attemptResult;
  final lessons = <int, LessonDetail>{};
  final enrollRequests = <String>[];
  final enrollEmails = <String?>[];
  final doubtsAsked = <String>[];
  List<StudentDoubt> doubtList = const [];
  StudentProfile? savedProfile;
  int renewCalls = 0;
  bool renewFails = false;

  @override
  Future<List<ExamCard>> exams(int courseId) async => examCards;
  @override
  Future<AttemptResult> result(String attemptId) async => attemptResult!;
  @override
  Future<LessonDetail> lesson(int contentId) async => lessons[contentId]!;
  @override
  Future<void> requestEnrollment(String courseSlug, {String? message, String? email}) async {
    enrollRequests.add(courseSlug);
    enrollEmails.add(email);
  }
  @override
  Future<List<StudentDoubt>> doubts() async => doubtList;
  @override
  Future<void> askDoubt(int courseId, String question, {String? attachmentPath}) async => doubtsAsked.add('$courseId:$question');
  @override
  Future<List<LiveClassItem>> liveClasses() async => const [];
  final joined = <int>[];
  ApiException? joinError;
  @override
  Future<void> joinLiveClass(int liveClassId) async {
    if (joinError != null) throw joinError!;
    joined.add(liveClassId);
  }
  @override
  Future<List<CourseProgress>> progress() async => const [];
  @override
  Future<StudentProfile> profile() async => savedProfile ?? const StudentProfile(name: 'Meera', mobile: '+919876543210', education: '10th');
  @override
  Future<void> saveProfile(StudentProfile p) async => savedProfile = p;
  @override
  Future<List<AppNotification>> notifications() async => const [];
  @override
  Future<List<RegisteredDevice>> devices() async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError(invocation.memberName.toString());
}

class FakePublicRepo implements PublicRepository {
  final queries = <String?>[];
  final otpSent = <String>[];
  final demoBodies = <Json>[];

  @override
  Future<List<CourseCard>> courses({String? q, int page = 1}) async {
    queries.add(q);
    const all = [
      CourseCard(slug: 'maths-10', title: 'Maths 10th', teacherName: 'Suresh', subject: 'Maths', language: 'en'),
      CourseCard(slug: 'science-10', title: 'Science 10th', teacherName: 'Kavita', subject: 'Science', language: 'mr'),
    ];
    return (q == null || q.isEmpty) ? all : all.where((c) => c.title.toLowerCase().contains(q.toLowerCase())).toList();
  }

  @override
  Future<CourseDetail> course(String slug) async => const CourseDetail(
        slug: 'maths-10',
        title: 'Maths 10th',
        teacherName: 'Suresh',
        description: 'Full board syllabus',
        demoVideos: [VideoRef(source: 'youtube', url: 'https://www.youtube.com/watch?v=abc')],
        batches: ['Morning · 7-9 am'],
        curriculum: [(name: 'Algebra', modules: ['Linear equations'])],
      );

  @override
  Future<void> sendOtp(String mobile, String purpose) async => otpSent.add('$mobile|$purpose');

  @override
  Future<void> requestDemo(Map<String, dynamic> body) async => demoBodies.add(body);
}

ExamPaper paperFixture({DateTime? deadlineAt, String mode = 'mock', Map<int, Json> answers = const {}}) => ExamPaper(
      attemptId: 'a-1',
      examId: 9,
      title: 'Unit Test 1',
      mode: mode,
      deadlineAt: deadlineAt,
      answers: answers,
      questions: const [
        ExamQuestion(id: 1, type: 'mcq', text: '2 + 2 = ?', marks: 1, options: [ExamOption(11, '3'), ExamOption(12, '4')]),
        ExamQuestion(id: 2, type: 'fill_blank', text: 'Capital of Maharashtra', marks: 2),
      ],
    );
