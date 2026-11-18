import '../../core/network/api_client.dart';
import '../models/teacher_models.dart';

/// Light teacher app (DECISIONS.md): requests, students, live classes, attendance, doubts.
abstract class TeacherRepository {
  Future<TeacherDashboardData> dashboard();
  Future<List<DemoRequest>> demoRequests({String? status});
  Future<void> scheduleDemo(int id, DateTime when, {String? meetLink});
  Future<WhatsAppResult> sendWhatsApp(int id);
  Future<void> setDemoStatus(int id, String status);
  Future<List<EnrollmentRequest>> enrollments({String? status});
  Future<List<Batch>> batches(int courseId);
  Future<void> approveEnrollment(int id, {required int batchId, required String startDate, required String endDate});
  Future<void> rejectEnrollment(int id, String reason);
  Future<List<StudentRow>> students({int? courseId});
  Future<void> setAccess(String studentPublicId, int courseId, {required String startDate, required String endDate, required bool accessEnabled});
  Future<List<LiveClass>> liveClasses();
  Future<void> setMeetLink(int liveClassId, String meetLink);
  Future<List<AttendanceRow>> attendance(int liveClassId);
  Future<void> saveAttendance(int liveClassId, List<AttendanceRow> rows);
  Future<List<Doubt>> doubts({String? status});
  Future<void> replyDoubt(int id, String reply);
}

class ApiTeacherRepository implements TeacherRepository {
  ApiTeacherRepository(this.api);
  final ApiClient api;

  List<Map<String, dynamic>> _list(dynamic data) => (data as List).cast<Map<String, dynamic>>();

  @override
  Future<TeacherDashboardData> dashboard() async => TeacherDashboardData.fromJson(await api.get('/teacher/dashboard') as Map<String, dynamic>);

  @override
  Future<List<DemoRequest>> demoRequests({String? status}) async =>
      _list(await api.get('/teacher/demo-requests', query: {'status': ?status})).map(DemoRequest.fromJson).toList();

  @override
  Future<void> scheduleDemo(int id, DateTime when, {String? meetLink}) =>
      api.post('/teacher/demo-requests/$id/schedule', {'scheduledAt': when.toUtc().toIso8601String(), if (meetLink != null && meetLink.isNotEmpty) 'meetLink': meetLink});

  @override
  Future<WhatsAppResult> sendWhatsApp(int id) async {
    try {
      await api.post('/teacher/demo-requests/$id/send-whatsapp');
      return const WhatsAppResult(sent: true);
    } on ApiException catch (e) {
      return WhatsAppResult(sent: false, message: e.message, fallbackUrl: e.details?['fallbackUrl'] as String?);
    }
  }

  @override
  Future<void> setDemoStatus(int id, String status) => api.post('/teacher/demo-requests/$id/${status == 'rejected' ? 'reject' : 'complete'}');

  @override
  Future<List<EnrollmentRequest>> enrollments({String? status}) async =>
      _list(await api.get('/teacher/enrollments', query: {'status': ?status})).map(EnrollmentRequest.fromJson).toList();

  @override
  Future<List<Batch>> batches(int courseId) async => _list(await api.get('/teacher/courses/$courseId/batches')).map(Batch.fromJson).toList();

  @override
  Future<void> approveEnrollment(int id, {required int batchId, required String startDate, required String endDate}) =>
      api.post('/teacher/enrollments/$id/approve', {'batchId': batchId, 'startDate': startDate, 'endDate': endDate});

  @override
  Future<void> rejectEnrollment(int id, String reason) => api.post('/teacher/enrollments/$id/reject', {'reason': reason});

  @override
  Future<List<StudentRow>> students({int? courseId}) async =>
      _list(await api.get('/teacher/students', query: {'course': ?courseId})).map(StudentRow.fromJson).toList();

  @override
  Future<void> setAccess(String studentPublicId, int courseId, {required String startDate, required String endDate, required bool accessEnabled}) =>
      api.put('/teacher/students/$studentPublicId/access/$courseId', {'startDate': startDate, 'endDate': endDate, 'accessEnabled': accessEnabled});

  @override
  Future<List<LiveClass>> liveClasses() async => _list(await api.get('/teacher/live-classes')).map(LiveClass.fromJson).toList();

  @override
  Future<void> setMeetLink(int liveClassId, String meetLink) => api.put('/teacher/live-classes/$liveClassId/meet-link', {'meetLink': meetLink});

  @override
  Future<List<AttendanceRow>> attendance(int liveClassId) async =>
      _list(await api.get('/teacher/live-classes/$liveClassId/attendance')).map(AttendanceRow.fromJson).toList();

  @override
  Future<void> saveAttendance(int liveClassId, List<AttendanceRow> rows) => api.put('/teacher/live-classes/$liveClassId/attendance', {
        'records': rows.map((r) => {'studentPublicId': r.studentPublicId, 'present': r.present == true}).toList(),
      });

  @override
  Future<List<Doubt>> doubts({String? status}) async =>
      _list(await api.get('/teacher/doubts', query: {'status': ?status})).map(Doubt.fromJson).toList();

  @override
  Future<void> replyDoubt(int id, String reply) => api.post('/teacher/doubts/$id/reply', {'reply': reply});
}
