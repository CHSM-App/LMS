import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/data/models/teacher_models.dart';
import 'package:lms_app/data/repositories/teacher_repository.dart';
import 'package:lms_app/presentation/viewModels/teacher_viewmodels.dart';

class FakeTeacherRepo implements TeacherRepository {
  @override
  Future<void> saveLiveClass({int? id, required int courseId, int? batchId, required String topic, required DateTime startsAt, required int durationMin, String? meetLink, String status = 'scheduled'}) async {}

  @override
  Future<void> cancelLiveClass(int id) async {}

  @override
  Future<void> generateClassLink(int liveClassId) async => meetLinks[liveClassId] = 'https://meet.google.com/xyz-abcd-efg';

  @override
  Future<String> generateMeetLink({required String topic, required DateTime startsAt, required int durationMin}) async => 'https://meet.google.com/xyz-abcd-efg';

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

  final meetLinks = <int, String>{};

  @override
  Future<List<TeacherCourseRef>> courses() async => [const TeacherCourseRef(id: 3, title: 'Maths')];

  @override
  Future<List<LiveScheduleRow>> liveSchedule(int courseId, int batchId) async => [];

  @override
  Future<void> saveLiveSchedule(int courseId, int batchId, Map<String, DateTime> dates, {Map<String, String> links = const {}}) async {}

  @override
  Future<List<LiveClass>> liveClasses() async => [
        LiveClass(id: 5, topic: 'Algebra', courseTitle: 'Maths', startsAt: DateTime.utc(2099), meetLink: meetLinks[5], needsMeetLink: meetLinks[5] == null, status: 'scheduled'),
      ];

  @override
  Future<void> setMeetLink(int liveClassId, String meetLink) async => meetLinks[liveClassId] = meetLink;

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

  test('LiveClass parses a missing Meet link', () {
    final c = LiveClass.fromJson({'id': 5, 'topic': 'Algebra', 'course': {'id': 3, 'title': 'Maths'}, 'startsAt': '2099-06-15T12:30:00.000Z', 'meetLink': null, 'needsMeetLink': true, 'status': 'scheduled'});
    expect(c.meetLink, isNull);
    expect(c.needsMeetLink, isTrue);
    expect(TodayClass.fromJson({'id': 5, 'topic': 'Algebra', 'startsAt': '2099-06-15T12:30:00.000Z', 'meetLink': null, 'course': 'Maths'}).meetLink, isNull);
  });

  test('Generate link on a class without one saves a link and reloads the list', () async {
    final repo = FakeTeacherRepo();
    final vm = LiveClassesViewModel(repo);
    await vm.load();
    expect(vm.state.data!.single.needsMeetLink, isTrue);
    expect(await vm.generateLink(5), isNull);
    expect(vm.state.data!.single.meetLink, 'https://meet.google.com/xyz-abcd-efg');
  });

  test('adding a Meet link saves it and reloads the list', () async {
    final repo = FakeTeacherRepo();
    final vm = LiveClassesViewModel(repo);
    await vm.load();
    expect(vm.state.data!.single.needsMeetLink, isTrue);
    expect(await vm.setMeetLink(5, 'https://meet.google.com/abc-defg-hij'), isNull);
    expect(vm.state.data!.single.meetLink, 'https://meet.google.com/abc-defg-hij');
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
