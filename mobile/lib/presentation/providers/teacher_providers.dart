import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/teacher_models.dart';
import '../../data/repositories/teacher_repository.dart';
import '../viewModels/teacher_viewmodels.dart';
import 'core_providers.dart';

final teacherRepositoryProvider = Provider<TeacherRepository>((ref) => ApiTeacherRepository(ref.read(apiClientProvider)));

final teacherDashboardProvider = StateNotifierProvider.autoDispose<TeacherDashboardViewModel, LoadState<TeacherDashboardData>>(
  (ref) => TeacherDashboardViewModel(ref.read(teacherRepositoryProvider)),
);

final requestsProvider = StateNotifierProvider.autoDispose<RequestsViewModel, RequestsState>((ref) => RequestsViewModel(ref.read(teacherRepositoryProvider)));

final studentsProvider = StateNotifierProvider.autoDispose<StudentsViewModel, LoadState<List<StudentRow>>>((ref) => StudentsViewModel(ref.read(teacherRepositoryProvider)));

final liveClassesProvider = StateNotifierProvider.autoDispose<LiveClassesViewModel, LoadState<List<LiveClass>>>(
  (ref) => LiveClassesViewModel(ref.read(teacherRepositoryProvider)),
);

final attendanceProvider = StateNotifierProvider.autoDispose.family<AttendanceViewModel, LoadState<List<AttendanceRow>>, int>(
  (ref, id) => AttendanceViewModel(ref.read(teacherRepositoryProvider), id),
);

final doubtsProvider = StateNotifierProvider.autoDispose<DoubtsViewModel, LoadState<List<Doubt>>>((ref) => DoubtsViewModel(ref.read(teacherRepositoryProvider)));

final batchesProvider = FutureProvider.autoDispose.family<List<Batch>, int>((ref, courseId) => ref.read(teacherRepositoryProvider).batches(courseId));
