import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../data/models/teacher_models.dart';
import '../../data/repositories/teacher_repository.dart';

@immutable
class LoadState<T> {
  const LoadState({this.data, this.loading = false, this.error});
  final T? data;
  final bool loading;
  final String? error;
}

class TeacherDashboardViewModel extends StateNotifier<LoadState<TeacherDashboardData>> {
  TeacherDashboardViewModel(this._repo) : super(const LoadState(loading: true));
  final TeacherRepository _repo;

  Future<void> load() async {
    state = LoadState(data: state.data, loading: true);
    try {
      state = LoadState(data: await _repo.dashboard());
    } on ApiException catch (e) {
      state = LoadState(data: state.data, error: e.message);
    }
  }
}

@immutable
class RequestsState {
  const RequestsState({this.demos = const [], this.enrollments = const [], this.loading = false, this.error, this.whatsApp = const {}});
  final List<DemoRequest> demos;
  final List<EnrollmentRequest> enrollments;
  final bool loading;
  final String? error;
  final Map<int, WhatsAppResult> whatsApp;

  RequestsState copyWith({List<DemoRequest>? demos, List<EnrollmentRequest>? enrollments, bool? loading, String? error, bool clearError = false, Map<int, WhatsAppResult>? whatsApp}) =>
      RequestsState(
        demos: demos ?? this.demos,
        enrollments: enrollments ?? this.enrollments,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        whatsApp: whatsApp ?? this.whatsApp,
      );
}

class RequestsViewModel extends StateNotifier<RequestsState> {
  RequestsViewModel(this._repo) : super(const RequestsState(loading: true));
  final TeacherRepository _repo;

  Future<void> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final demos = await _repo.demoRequests();
      final enrollments = await _repo.enrollments(status: 'pending');
      state = state.copyWith(demos: demos, enrollments: enrollments, loading: false);
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    }
  }

  Future<String?> schedule(int id, DateTime? when, {String? meetLink}) async {
    if (when == null) return 'needWhen';
    try {
      await _repo.scheduleDemo(id, when, meetLink: meetLink);
      await load();
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }

  Future<WhatsAppResult> sendWhatsApp(int id) async {
    final r = await _repo.sendWhatsApp(id);
    state = state.copyWith(whatsApp: {...state.whatsApp, id: r});
    return r;
  }

  Future<void> setDemoStatus(int id, String status) async {
    await _repo.setDemoStatus(id, status);
    await load();
  }

  /// Returns null on success, an l10n key ('needBatch', 'needDates', 'dateOrder') or a server message.
  Future<String?> approve(int id, {required int? batchId, required String startDate, required String endDate}) async {
    if (batchId == null) return 'needBatch';
    if (startDate.isEmpty || endDate.isEmpty) return 'needDates';
    if (endDate.compareTo(startDate) < 0) return 'dateOrder';
    try {
      await _repo.approveEnrollment(id, batchId: batchId, startDate: startDate, endDate: endDate);
      await load();
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }

  Future<String?> reject(int id, String reason) async {
    if (reason.trim().length < 5) return 'minReason';
    try {
      await _repo.rejectEnrollment(id, reason.trim());
      await load();
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }
}

class StudentsViewModel extends StateNotifier<LoadState<List<StudentRow>>> {
  StudentsViewModel(this._repo) : super(const LoadState(loading: true));
  final TeacherRepository _repo;

  Future<void> load() async {
    state = LoadState(data: state.data, loading: true);
    try {
      state = LoadState(data: await _repo.students());
    } on ApiException catch (e) {
      state = LoadState(data: state.data, error: e.message);
    }
  }

  Future<String?> setAccess(StudentRow s, bool enabled) async {
    try {
      await _repo.setAccess(s.publicId, s.courseId, startDate: s.startDate ?? '', endDate: s.endDate ?? '', accessEnabled: enabled);
      await load();
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }
}

class LiveClassesViewModel extends StateNotifier<LoadState<List<LiveClass>>> {
  LiveClassesViewModel(this._repo) : super(const LoadState(loading: true));
  final TeacherRepository _repo;

  Future<void> load() async {
    state = LoadState(data: state.data, loading: true);
    try {
      state = LoadState(data: await _repo.liveClasses());
    } on ApiException catch (e) {
      state = LoadState(data: state.data, error: e.message);
    }
  }

  /// Saves the Meet link, then reloads. Returns the error message, or null on success.
  Future<String?> setMeetLink(int liveClassId, String meetLink) async {
    try {
      await _repo.setMeetLink(liveClassId, meetLink.trim());
    } on ApiException catch (e) {
      return e.message;
    }
    await load();
    return null;
  }
}

class AttendanceViewModel extends StateNotifier<LoadState<List<AttendanceRow>>> {
  AttendanceViewModel(this._repo, this.liveClassId) : super(const LoadState(loading: true));
  final TeacherRepository _repo;
  final int liveClassId;

  Future<void> load() async {
    try {
      state = LoadState(data: await _repo.attendance(liveClassId));
    } on ApiException catch (e) {
      state = LoadState(error: e.message);
    }
  }

  void mark(String studentPublicId, bool present) {
    state = LoadState(data: [for (final r in state.data ?? <AttendanceRow>[]) r.studentPublicId == studentPublicId ? r.copyWith(present: present) : r]);
  }

  void markAllPresent() {
    state = LoadState(data: [for (final r in state.data ?? <AttendanceRow>[]) r.copyWith(present: true)]);
  }

  Future<String?> save() async {
    try {
      await _repo.saveAttendance(liveClassId, state.data ?? []);
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }
}

class DoubtsViewModel extends StateNotifier<LoadState<List<Doubt>>> {
  DoubtsViewModel(this._repo) : super(const LoadState(loading: true));
  final TeacherRepository _repo;

  Future<void> load() async {
    state = LoadState(data: state.data, loading: true);
    try {
      state = LoadState(data: await _repo.doubts(status: 'open'));
    } on ApiException catch (e) {
      state = LoadState(data: state.data, error: e.message);
    }
  }

  Future<String?> reply(int id, String text) async {
    if (text.trim().isEmpty) return 'required';
    try {
      await _repo.replyDoubt(id, text.trim());
      await load();
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }
}
