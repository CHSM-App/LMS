import { useState } from 'react';
import {
  Banner, Button, Card, Checkbox, EmptyState, FileUpload, Input, Modal, OtpInput, PageHeader, ProgressBar, Select, StatusBadge, Table, Textarea, UploadProgress,
} from '../components';

// Dev-only page (/_styleguide): every component in every state, for visual checks at 360px and 1280px.
export default function StyleGuide() {
  const [otp, setOtp] = useState('');
  const [open, setOpen] = useState(false);
  const statuses = ['pending', 'approved', 'rejected', 'blocked', 'draft', 'published', 'expired', 'paused'];
  return (
    <div className="container stack">
      <PageHeader title="Style guide" subtitle="Brand palette from design-tokens/tokens.json" actions={<Button>Primary action</Button>} />
      <Card title="Buttons">
        <div className="row">
          <Button>Book live demo</Button>
          <Button variant="compact">Approve</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="ghost">Ghost</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="link">Link button</Button>
        </div>
      </Card>
      <Card title="Badges and progress">
        <div className="row">{statuses.map((s) => <StatusBadge key={s} status={s} />)}</div>
        <ProgressBar value={64} label="Course progress" />
        <UploadProgress fileName="lesson-1.mp4" percent={42} onCancel={() => {}} />
      </Card>
      <Card title="Banners">
        <Banner kind="info" message="Information banner" />
        <Banner kind="warning" message="Your subscription ended on 12 Nov. Contact the admin to renew." />
        <Banner kind="error" message="Something went wrong. Try again." />
        <Banner kind="success" message="Saved" />
      </Card>
      <Card title="Form">
        <div className="grid grid--2">
          <Input label="Mobile number" hint="10-digit mobile number" />
          <Input label="With error" error="Enter a valid 10-digit mobile number" />
          <Select label="Language" options={[{ value: 'en', label: 'English' }, { value: 'mr', label: 'मराठी' }]} />
          <Textarea label="Message" />
          <FileUpload label="Photo" maxMb={5} onFile={() => {}} />
        </div>
        <Checkbox label="I agree to the Terms of Use" />
        <OtpInput value={otp} onChange={setOtp} />
      </Card>
      <Table columns={[{ key: 'a', header: 'Name' }, { key: 'b', header: 'Status', render: () => <StatusBadge status="pending" /> }]} rows={[{ id: 1, a: 'सुरेश पाटील' }, { id: 2, a: 'Asha Kulkarni' }]} />
      <EmptyState title="No courses yet" body="Create your first course to get started." action={{ label: 'Create course', onClick: () => {} }} />
      <Button variant="secondary" onClick={() => setOpen(true)}>Open modal</Button>
      <Modal open={open} title="Example dialog" onClose={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>Done</Button>}>
        <p>Focus is trapped here. Press Escape to close.</p>
      </Modal>
    </div>
  );
}
