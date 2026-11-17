import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components';

// Placeholder for pages that later phases replace.
export default function ComingSoon({ title }) {
  const { t } = useTranslation();
  return (
    <div className="container">
      <PageHeader title={t(title)} />
    </div>
  );
}
