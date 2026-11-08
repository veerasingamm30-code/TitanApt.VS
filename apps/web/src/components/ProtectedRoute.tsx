import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@titanapt/shared';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, Loader } from './ui';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading, bootstrapError, retryBootstrap } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-boot">
        <div className="brand brand-dark">
          <span className="brand-mark">TA</span>
          <span>
            <strong>TitanApt</strong>
            <small>Placement studio</small>
          </span>
        </div>
        <Loader label="Opening your workspace" />
      </div>
    );
  }

  if (bootstrapError) {
    // Transient failure (e.g. server restart): never loses the learner's place —
    // offer a retry instead of kicking them to /login.
    return (
      <ErrorState
        message={bootstrapError}
        onRetry={retryBootstrap}
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
