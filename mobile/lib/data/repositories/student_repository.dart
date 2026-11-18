import '../../core/network/api_client.dart';
import '../../core/network/file_url.dart';
import '../models/student_models.dart';

/// Public catalog + demo request (no login).
abstract class PublicRepository {
  Future<List<CourseCard>> courses({String? q, int page = 1});
  Future<CourseDetail> course(String slug);
  Future<void> sendOtp(String mobile, String purpose);
  Future<void> requestDemo(Map<String, dynamic> body);
}

class ApiPublicRepository implements PublicRepository {
  ApiPublicRepository(this.api);
  final ApiClient api;

  @override
  Future<List<CourseCard>> courses({String? q, int page = 1}) async {
    final res = await api.getPage('/public/courses', query: {if (q != null && q.trim().isNotEmpty) 'q': q.trim(), 'page': page, 'limit': 20});
    return (res['data'] as List).cast<Json>().map(CourseCard.fromJson).toList();
  }

  @override
  Future<CourseDetail> course(String slug) async => CourseDetail.fromJson(await api.get('/public/courses/$slug') as Json);

  @override
  Future<void> sendOtp(String mobile, String purpose) => api.post('/auth/otp/send', {'mobile': mobile, 'purpose': purpose});

  @override
  Future<void> requestDemo(Map<String, dynamic> body) => api.post('/public/demo-requests', body);
}

/// Everything a logged-in student does.
abstract class StudentRepository {
  Future<StudentDashboard> dashboard();
  Future<void> requestEnrollment(String courseSlug, {String? message});
  Future<CourseView> course(int courseId);
  Future<LessonDetail> lesson(int contentId);
  Future<void> saveProgress(int contentId, {int? positionSec, bool? completed});
  Future<void> syncProgress(List<Json> items);
  Future<List<ExamCard>> exams(int courseId);
  Future<ExamPaper> startAttempt(int examId);
  Future<PracticeFeedback?> saveAnswer(String attemptId, int questionId, Json answer);
  Future<void> submit(String attemptId);
  Future<AttemptResult> result(String attemptId);
  Future<List<LiveClassItem>> liveClasses();
  Future<List<StudentDoubt>> doubts();
  Future<void> askDoubt(int courseId, String question, {String? attachmentPath});
  Future<List<CourseProgress>> progress();
  Future<StudentProfile> profile();
  Future<void> saveProfile(StudentProfile p);
  Future<List<AppNotification>> notifications();
  Future<void> markAllRead();
  // Offline downloads
  Future<void> registerDevice(String deviceId, String deviceName, String platform);
  Future<List<RegisteredDevice>> devices();
  Future<void> removeDevice(String deviceId);
  Future<DownloadTicket> issueDownload(int contentId, String deviceId);
  Future<List<RenewResult>> renew(String deviceId, List<int> contentIds);
}

class ApiStudentRepository implements StudentRepository {
  ApiStudentRepository(this.api);
  final ApiClient api;

  List<Json> _list(dynamic data) => (data as List).cast<Json>();

  @override
  Future<StudentDashboard> dashboard() async => StudentDashboard.fromJson(await api.get('/student/dashboard') as Json);

  @override
  Future<void> requestEnrollment(String courseSlug, {String? message}) =>
      api.post('/student/enrollments', {'courseSlug': courseSlug, 'message': (message == null || message.trim().isEmpty) ? null : message.trim()});

  @override
  Future<CourseView> course(int courseId) async => CourseView.fromJson(await api.get('/student/courses/$courseId') as Json);

  @override
  Future<LessonDetail> lesson(int contentId) async => LessonDetail.fromJson(await api.get('/student/contents/$contentId') as Json);

  @override
  Future<void> saveProgress(int contentId, {int? positionSec, bool? completed}) =>
      api.post('/student/contents/$contentId/progress', {'positionSec': ?positionSec, 'completed': ?completed});

  @override
  Future<void> syncProgress(List<Json> items) => api.post('/student/progress/sync', {'items': items});

  @override
  Future<List<ExamCard>> exams(int courseId) async => _list(await api.get('/student/courses/$courseId/exams')).map(ExamCard.fromJson).toList();

  @override
  Future<ExamPaper> startAttempt(int examId) async => ExamPaper.fromJson(await api.post('/student/exams/$examId/attempts') as Json);

  @override
  Future<PracticeFeedback?> saveAnswer(String attemptId, int questionId, Json answer) async {
    final data = await api.put('/student/attempts/$attemptId/answers/$questionId', answer);
    if (data is Json && data['correct'] is bool) return PracticeFeedback(correct: data['correct'] as bool, explanation: data['explanation'] as String?, explanationImageUrl: absoluteFileUrl(data['explanationImageUrl'] as String?));
    return null;
  }

  @override
  Future<void> submit(String attemptId) => api.post('/student/attempts/$attemptId/submit');

  @override
  Future<AttemptResult> result(String attemptId) async => AttemptResult.fromJson(await api.get('/student/attempts/$attemptId/result') as Json);

  @override
  Future<List<LiveClassItem>> liveClasses() async => _list(await api.get('/student/live-classes')).map(LiveClassItem.fromJson).toList();

  @override
  Future<List<StudentDoubt>> doubts() async => _list(await api.get('/student/doubts')).map(StudentDoubt.fromJson).toList();

  @override
  Future<void> askDoubt(int courseId, String question, {String? attachmentPath}) =>
      api.postForm('/student/doubts', {'courseId': '$courseId', 'question': question.trim()}, fileField: 'attachment', filePath: attachmentPath);

  @override
  Future<List<CourseProgress>> progress() async => _list((await api.get('/student/progress') as Json)['courses']).map(CourseProgress.fromJson).toList();

  @override
  Future<StudentProfile> profile() async => StudentProfile.fromJson(await api.get('/student/profile') as Json);

  @override
  Future<void> saveProfile(StudentProfile p) => api.put('/student/profile', p.toJson());

  @override
  Future<List<AppNotification>> notifications() async =>
      ((await api.getPage('/notifications', query: {'limit': 50}))['data'] as List).cast<Json>().map(AppNotification.fromJson).toList();

  @override
  Future<void> markAllRead() => api.post('/notifications/read-all');

  @override
  Future<void> registerDevice(String deviceId, String deviceName, String platform) =>
      api.post('/student/devices', {'deviceId': deviceId, 'deviceName': deviceName, 'platform': platform});

  @override
  Future<List<RegisteredDevice>> devices() async => _list(await api.get('/student/devices')).map(RegisteredDevice.fromJson).toList();

  @override
  Future<void> removeDevice(String deviceId) => api.delete('/student/devices/$deviceId');

  @override
  Future<DownloadTicket> issueDownload(int contentId, String deviceId) async =>
      DownloadTicket.fromJson(await api.postWith('/student/contents/$contentId/download', null, {'X-Device-Id': deviceId}) as Json);

  @override
  Future<List<RenewResult>> renew(String deviceId, List<int> contentIds) async =>
      _list(await api.post('/student/downloads/renew', {'deviceId': deviceId, 'contentIds': contentIds})).map(RenewResult.fromJson).toList();
}
