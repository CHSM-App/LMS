import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/data/models/teacher_models.dart';
import 'package:lms_app/data/repositories/teacher_repository.dart';
import 'package:lms_app/presentation/viewModels/teacher_viewmodels.dart';

class FakeTeacherRepo implements TeacherRepository {
  final scheduled = <int, String>{};
  final approved = <int, Map<String, dynamic>>{};
  List<AttendanceRow> savedAttendance = [];
  bool failWhatsApp = true;

  @override
  Future<TeacherDashboardData> dashboard() async => const TeacherDashboardData(pendingDemoRequests: 2, pendingEnrollments: 1, openDoubts: 3, activeStudents: 12, todaysClasses: []);

  @override
  Future<List<DemoRequest>> demoRequests({String? status}) async => [
        DemoRequest(id: 1, name: 'Asha', mobile: '+919811100001', education: '10th', courseTitle: 'Maths', status: 'scheduled', meetLink: 'https://meet.google.com/abc-defg-hij', scheduledAt: DateTime.utc(2099)),
      ];

  @override
  Future<void> scheduleDemo(int id, DateTime when, {String? meetLink}) async => scheduled[id] = when.toIso8601String();

  @override
  Future<WhatsAppResult> sendWhatsApp(int id) async =>
      failWhatsApp ? const WhatsAppResult(sent: false, message: 'WhatsApp message not sent. Try again.', fallbackUrl: 'https://wa.me/919811100001?text=hi') : const WhatsAppResult(sent: true);

  @override
  Future<void> setDemoStatus(int id, String status) async {}

  @override
  Future<List<EnrollmentRequest>> enrollments({String? status}) async =>
      [const EnrollmentRequest(id: 7, studentName: 'Meera', studentMobile: '+919811100002', courseId: 3, courseTitle: 'Maths', status: 'pending')];

  @override
  Future<List<Batch>> batches(int courseId) async => [const Batch(id: 11, name: 'Morning', status: 'active', studentCount: 1, maxStudents: 30)];

  @override
  Future<void> approveEnrollment(int id, {required int batchId, required String startDate, required String endDate}) async =>
      approved[id] = {'batchId': batchId, 'startDate': startDate, 'endDate': endDate};

  @override
  Future<void> rejectEnrollment(int id, String reason) async {}

  @override
  Future<List<StudentRow>> students({int? courseId}) async => [];

  @override
  Future<void> setAccess(String studentPublicId, int courseId, {required String startDate, required String endDate, required bool accessEnabled}) async {}

  @override
  Future<List<LiveClass>> liveClasses() async => [];

  @override
  Future<List<AttendanceRow>> attendance(int liveClassId) async => [
        const AttendanceRow(studentPublicId: 'a', name: 'A', present: null),
        const AttendanceRow(studentPublicId: 'b', name: 'B', present: false),
      ];

  @override
  Future<void> saveAttendance(int liveClassId, List<AttendanceRow> rows) async => savedAttendance = rows;

  @override
  Future<List<Doubt>> doubts({String? status}) async => [];

  @override
  Future<void> replyDoubt(int id, String reply) async {}
}

void main() {
  test('dashboard loads the counts', () async {
    final vm = TeacherDashboardViewModel(FakeTeacherRepo());
    await vm.load();
    expect(vm.state.data!.pendingDemoRequests, 2);
    expect(vm.state.loading, isFalse);
  });

  test('WhatsApp failure keeps the fallback link; success clears it', () async {
    final repo = FakeTeacherRepo();
    final vm = RequestsViewModel(repo);
    await vm.load();
    final r1 = await vm.sendWhatsApp(1);
    expect(r1.sent, isFalse);
    expect(vm.state.whatsApp[1]!.fallbackUrl, 'https://wa.me/919811100001?text=hi');
    repo.failWhatsApp = false;
    final r2 = await vm.sendWhatsApp(1);
    expect(r2.sent, isTrue);
    expect(vm.state.whatsApp[1]!.sent, isTrue);
  });

  test('approve refuses without a batch or dates, then approves', () async {
    final repo = FakeTeacherRepo();
    final vm = RequestsViewModel(repo);
    expect(await vm.approve(7, batchId: null, startDate: '2026-01-01', endDate: '2026-12-31'), 'needBatch');
    expect(await vm.approve(7, batchId: 11, startDate: '2026-01-01', endDate: ''), 'needDates');
    expect(await vm.approve(7, batchId: 11, startDate: '2026-12-31', endDate: '2026-01-01'), 'dateOrder');
    expect(await vm.approve(7, batchId: 11, startDate: '2026-01-01', endDate: '2026-12-31'), isNull);
    expect(repo.approved[7], {'batchId': 11, 'startDate': '2026-01-01', 'endDate': '2026-12-31'});
  });

  test('attendance: mark all present then save sends every student', () async {
    final repo = FakeTeacherRepo();
    final vm = AttendanceViewModel(repo, 5);
    await vm.load();
    vm.markAllPresent();
    await vm.save();
    expect(repo.savedAttendance.map((r) => r.present), [true, true]);
  });

  test('ApiException message surfaces as the error', () async {
    final vm = TeacherDashboardViewModel(_FailingRepo());
    await vm.load();
    expect(vm.state.error, 'Log in to continue');
  });
}

class _FailingRepo extends FakeTeacherRepo {
  @override
  Future<TeacherDashboardData> dashboard() async => throw const ApiException(401, 'Log in to continue');
}
