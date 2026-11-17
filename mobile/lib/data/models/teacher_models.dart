// Plain immutable models for the light teacher app (hand-written fromJson; see ledger ruling on codegen).

DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v as String);

class TodayClass {
  const TodayClass({required this.id, required this.topic, required this.startsAt, required this.meetLink, required this.course, this.batch});
  final int id;
  final String topic;
  final DateTime startsAt;
  final String meetLink;
  final String course;
  final String? batch;

  factory TodayClass.fromJson(Map<String, dynamic> j) => TodayClass(
        id: j['id'] as int,
        topic: j['topic'] as String,
        startsAt: DateTime.parse(j['startsAt'] as String),
        meetLink: j['meetLink'] as String,
        course: j['course'] as String,
        batch: j['batch'] as String?,
      );
}

class TeacherDashboardData {
  const TeacherDashboardData({required this.pendingDemoRequests, required this.pendingEnrollments, required this.openDoubts, required this.activeStudents, required this.todaysClasses});
  final int pendingDemoRequests;
  final int pendingEnrollments;
  final int openDoubts;
  final int activeStudents;
  final List<TodayClass> todaysClasses;

  factory TeacherDashboardData.fromJson(Map<String, dynamic> j) => TeacherDashboardData(
        pendingDemoRequests: j['pendingDemoRequests'] as int,
        pendingEnrollments: j['pendingEnrollments'] as int,
        openDoubts: j['openDoubts'] as int,
        activeStudents: j['activeStudents'] as int,
        todaysClasses: (j['todaysClasses'] as List).map((e) => TodayClass.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class DemoRequest {
  const DemoRequest({required this.id, required this.name, required this.mobile, required this.education, required this.courseTitle, required this.status, this.meetLink, this.scheduledAt, this.message, this.whatsappSentAt});
  final int id;
  final String name;
  final String mobile;
  final String education;
  final String courseTitle;
  final String status;
  final String? meetLink;
  final DateTime? scheduledAt;
  final String? message;
  final DateTime? whatsappSentAt;

  factory DemoRequest.fromJson(Map<String, dynamic> j) => DemoRequest(
        id: j['id'] as int,
        name: j['name'] as String,
        mobile: j['mobile'] as String,
        education: (j['education'] ?? '') as String,
        courseTitle: (j['course'] as Map<String, dynamic>)['title'] as String,
        status: j['status'] as String,
        meetLink: j['meetLink'] as String?,
        scheduledAt: _date(j['scheduledAt']),
        message: j['message'] as String?,
        whatsappSentAt: _date(j['whatsappSentAt']),
      );
}

class EnrollmentRequest {
  const EnrollmentRequest({required this.id, required this.studentName, required this.studentMobile, required this.courseId, required this.courseTitle, required this.status, this.batchName, this.message});
  final int id;
  final String studentName;
  final String studentMobile;
  final int courseId;
  final String courseTitle;
  final String status;
  final String? batchName;
  final String? message;

  factory EnrollmentRequest.fromJson(Map<String, dynamic> j) {
    final s = j['student'] as Map<String, dynamic>;
    final c = j['course'] as Map<String, dynamic>;
    final b = j['batch'] as Map<String, dynamic>?;
    return EnrollmentRequest(
      id: j['id'] as int,
      studentName: s['name'] as String,
      studentMobile: (s['mobile'] ?? '') as String,
      courseId: c['id'] as int,
      courseTitle: c['title'] as String,
      status: j['status'] as String,
      batchName: b?['name'] as String?,
      message: j['message'] as String?,
    );
  }
}

class Batch {
  const Batch({required this.id, required this.name, required this.status, required this.studentCount, this.maxStudents});
  final int id;
  final String name;
  final String status;
  final int studentCount;
  final int? maxStudents;

  factory Batch.fromJson(Map<String, dynamic> j) => Batch(
        id: j['id'] as int,
        name: j['name'] as String,
        status: j['status'] as String,
        studentCount: (j['studentCount'] ?? 0) as int,
        maxStudents: j['maxStudents'] as int?,
      );
}

class StudentRow {
  const StudentRow({required this.publicId, required this.name, required this.mobile, required this.courseId, required this.courseTitle, required this.subscriptionStatus, this.batchName, this.startDate, this.endDate, this.accessEnabled = true});
  final String publicId;
  final String name;
  final String mobile;
  final int courseId;
  final String courseTitle;
  final String subscriptionStatus;
  final String? batchName;
  final String? startDate;
  final String? endDate;
  final bool accessEnabled;

  factory StudentRow.fromJson(Map<String, dynamic> j) {
    final c = j['course'] as Map<String, dynamic>;
    final b = j['batch'] as Map<String, dynamic>?;
    return StudentRow(
      publicId: j['publicId'] as String,
      name: j['name'] as String,
      mobile: (j['mobile'] ?? '') as String,
      courseId: c['id'] as int,
      courseTitle: c['title'] as String,
      subscriptionStatus: j['subscriptionStatus'] as String,
      batchName: b?['name'] as String?,
      startDate: j['startDate'] as String?,
      endDate: j['endDate'] as String?,
      accessEnabled: (j['accessEnabled'] ?? true) as bool,
    );
  }
}

class LiveClass {
  const LiveClass({required this.id, required this.topic, required this.courseTitle, required this.startsAt, required this.meetLink, required this.status, this.batchName});
  final int id;
  final String topic;
  final String courseTitle;
  final DateTime startsAt;
  final String meetLink;
  final String status;
  final String? batchName;

  factory LiveClass.fromJson(Map<String, dynamic> j) => LiveClass(
        id: j['id'] as int,
        topic: j['topic'] as String,
        courseTitle: (j['course'] as Map<String, dynamic>)['title'] as String,
        startsAt: DateTime.parse(j['startsAt'] as String),
        meetLink: j['meetLink'] as String,
        status: j['status'] as String,
        batchName: (j['batch'] as Map<String, dynamic>?)?['name'] as String?,
      );
}

class AttendanceRow {
  const AttendanceRow({required this.studentPublicId, required this.name, required this.present});
  final String studentPublicId;
  final String name;
  final bool? present;

  AttendanceRow copyWith({bool? present}) => AttendanceRow(studentPublicId: studentPublicId, name: name, present: present ?? this.present);

  factory AttendanceRow.fromJson(Map<String, dynamic> j) =>
      AttendanceRow(studentPublicId: j['studentPublicId'] as String, name: j['name'] as String, present: j['present'] as bool?);
}

class Doubt {
  const Doubt({required this.id, required this.studentName, required this.courseTitle, required this.question, required this.status, this.reply, required this.createdAt});
  final int id;
  final String studentName;
  final String courseTitle;
  final String question;
  final String status;
  final String? reply;
  final DateTime createdAt;

  factory Doubt.fromJson(Map<String, dynamic> j) => Doubt(
        id: j['id'] as int,
        studentName: (j['student'] as Map<String, dynamic>)['name'] as String,
        courseTitle: (j['course'] as Map<String, dynamic>)['title'] as String,
        question: j['question'] as String,
        status: j['status'] as String,
        reply: j['reply'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}

class WhatsAppResult {
  const WhatsAppResult({required this.sent, this.message, this.fallbackUrl});
  final bool sent;
  final String? message;
  final String? fallbackUrl;
}
