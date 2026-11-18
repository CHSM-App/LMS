import { render, screen } from '@testing-library/react';
import '../../../i18n';
import { LiveLessonPanel } from '../LiveLessonPanel';

const base = {
  id: 50, courseId: 7, title: 'Live: factorisation', type: 'live', videoSource: null, url: null, downloadable: false,
  live: { startsAt: '2099-06-15T12:30:00.000Z', durationMin: 60, stage: 'upcoming', meetLink: 'https://meet.google.com/abc-defg-hij' },
};
const withStage = (stage, extra = {}) => ({ ...base, ...extra, live: { ...base.live, stage, ...(extra.live || {}) } });

test('upcoming shows the start time and no Join button', () => {
  render(<LiveLessonPanel content={base} />);
  expect(screen.getByText(/Starts/)).toBeInTheDocument();
  expect(screen.getByText('Upcoming')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Join class' })).not.toBeInTheDocument();
});

test('live shows a Join button that opens Meet in a new tab', () => {
  render(<LiveLessonPanel content={withStage('live')} />);
  const join = screen.getByRole('link', { name: 'Join class' });
  expect(join).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
  expect(join).toHaveAttribute('target', '_blank');
  expect(join).toHaveAttribute('rel', 'noopener noreferrer');
});

test('ended without a recording says the recording is coming', () => {
  render(<LiveLessonPanel content={withStage('ended', { live: { meetLink: undefined } })} />);
  expect(screen.getByText('Recording coming soon')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Join class' })).not.toBeInTheDocument();
});

test('recorded plays the recording', () => {
  const { container } = render(<LiveLessonPanel content={withStage('recorded', { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123', live: { meetLink: undefined } })} />);
  expect(container.querySelector('iframe')).not.toBeNull();
  expect(screen.queryByText('Recording coming soon')).not.toBeInTheDocument();
});

test('cancelled shows the cancelled message and no Join', () => {
  render(<LiveLessonPanel content={withStage('cancelled', { live: { meetLink: undefined } })} />);
  expect(screen.getByText('This class was cancelled.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Join class' })).not.toBeInTheDocument();
});

test('live without a Meet link tells the student the teacher will share it', () => {
  render(<LiveLessonPanel content={withStage('live', { live: { meetLink: undefined, waitingForLink: true } })} />);
  expect(screen.queryByRole('link', { name: 'Join class' })).not.toBeInTheDocument();
  expect(screen.getByText('The teacher will share the link soon')).toBeInTheDocument();
});
