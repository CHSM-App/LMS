import { Link } from 'react-router-dom';
import { Icon } from './Icon';

// "← Back to …" link shown at the top of any page that sits one level below a list.
export function BackLink({ to, children }) {
  return (
    <Link to={to} className="back-link">
      <Icon name="arrowLeft" size={16} />
      <span>{children}</span>
    </Link>
  );
}
