import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button, OtpInput, Table, Modal, StatusBadge, FileUpload, ProgressBar, Banner, Input } from '../index';

test('Button loading is disabled and busy', () => {
  render(<Button loading>Save changes</Button>);
  const b = screen.getByRole('button', { name: /save changes/i });
  expect(b).toBeDisabled();
  expect(b).toHaveAttribute('aria-busy', 'true');
});

test('OtpInput paste fills all boxes; backspace moves focus back', async () => {
  const onChange = vi.fn();
  function Wrap() {
    const [v, setV] = useState('');
    return <OtpInput value={v} onChange={(x) => { setV(x); onChange(x); }} />;
  }
  render(<Wrap />);
  const boxes = screen.getAllByRole('textbox');
  expect(boxes).toHaveLength(6);
  fireEvent.paste(boxes[0], { clipboardData: { getData: () => '123456' } });
  expect(onChange).toHaveBeenLastCalledWith('123456');
  boxes[5].focus();
  await userEvent.keyboard('{Backspace}{Backspace}');
  expect(document.activeElement).toBe(boxes[4]);
});

test('Table shows the empty state when there are no rows', () => {
  render(<Table columns={[{ key: 'name', header: 'Name' }]} rows={[]} empty="No teachers yet" />);
  expect(screen.getByText('No teachers yet')).toBeInTheDocument();
});

test('Modal closes on Escape and returns focus to the trigger', async () => {
  function Wrap() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Modal open={open} title="Reject request" onClose={() => setOpen(false)}>
          <input aria-label="Reason" />
        </Modal>
      </>
    );
  }
  render(<Wrap />);
  const trigger = screen.getByText('Open');
  trigger.focus();
  await userEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Reject request' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.activeElement).toBe(trigger);
});

test('StatusBadge renders the translated word', () => {
  render(<StatusBadge status="rejected" />);
  expect(screen.getByText('Rejected')).toBeInTheDocument();
});

test('FileUpload rejects files over the limit', () => {
  const onFile = vi.fn();
  render(<FileUpload label="Photo" accept="image/*" maxMb={5} onFile={onFile} />);
  const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Photo'), { target: { files: [big] } });
  expect(screen.getByText('File is larger than 5 MB')).toBeInTheDocument();
  expect(onFile).not.toHaveBeenCalled();
});

test('ProgressBar always shows the percentage as text', () => {
  render(<ProgressBar value={42} label="Course progress" />);
  expect(screen.getByRole('progressbar', { name: 'Course progress' })).toHaveAttribute('aria-valuenow', '42');
  expect(screen.getByText('42%')).toBeInTheDocument();
});

test('Banner shows message and action', () => {
  render(<Banner kind="warning" message="Your subscription ended" action={<a href="/x">Contact admin</a>} />);
  expect(screen.getByRole('status')).toHaveTextContent('Your subscription ended');
});

test('Input links its error to the field', () => {
  render(<Input label="Mobile number" name="mobile" error="Enter a 10-digit mobile number" />);
  const input = screen.getByLabelText('Mobile number');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Enter a 10-digit mobile number');
});
