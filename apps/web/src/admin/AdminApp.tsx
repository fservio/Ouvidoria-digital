import React, { useState, Suspense } from 'react';
import Login from './Login';
import Tickets from './Tickets';

const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    window.location.href = '/';
  };

  const path = window.location.pathname.replace('/admin', '') || '/';

  if (!token && path !== '/login' && path !== '/') {
    window.location.href = '/admin/login';
    return null;
  }

  if (!token && (path === '/login' || path === '/')) {
    return <Login onLogin={(t) => {
      localStorage.setItem('admin_token', t);
      setToken(t);
    }} />;
  }

  if (path.startsWith('/tickets') || path === '/') {
    return <Tickets token={token!} onLogout={logout} />;
  }

  if (path.startsWith('/integrations/meta')) {
    const IntegrationsMeta = React.lazy(() => import('./IntegrationsMeta'));
    return (
      <Suspense fallback={<div className="p-6">Carregando...</div>}>
        <IntegrationsMeta token={token!} onLogout={logout} />
      </Suspense>
    );
  }

  if (path.startsWith('/integrations/n8n')) {
    const IntegrationsN8n = React.lazy(() => import('./IntegrationsN8n'));
    return (
      <Suspense fallback={<div className="p-6">Carregando...</div>}>
        <IntegrationsN8n token={token!} onLogout={logout} />
      </Suspense>
    );
  }

  if (path.startsWith('/templates')) {
    const Templates = React.lazy(() => import('./Templates'));
    return (
      <Suspense fallback={<div className="p-6">Carregando...</div>}>
        <Templates token={token!} onLogout={logout} />
      </Suspense>
    );
  }

  if (path.startsWith('/secretariats')) {
    const SecretariatsQueues = React.lazy(() => import('./SecretariatsQueues'));
    return (
      <Suspense fallback={<div className="p-6">Carregando...</div>}>
        <SecretariatsQueues token={token!} onLogout={logout} />
      </Suspense>
    );
  }

  if (path.startsWith('/routing-rules')) {
    const RoutingRules = React.lazy(() => import('./RoutingRules'));
    return (
      <Suspense fallback={<div className="p-6">Carregando...</div>}>
        <RoutingRules token={token!} onLogout={logout} />
      </Suspense>
    );
  }

  if (path.startsWith('/audit')) {
    const Audit = React.lazy(() => import('./Audit'));
    return (
      <Suspense fallback={<div className="p-6">Carregando...</div>}>
        <Audit token={token!} onLogout={logout} />
      </Suspense>
    );
  }

  if (path.startsWith('/users')) {
    const Users = React.lazy(() => import('./Users'));
    return (
      <Suspense fallback={<div className="p-6">Carregando...</div>}>
        <Users token={token!} onLogout={logout} />
      </Suspense>
    );
  }

  return <Tickets token={token!} onLogout={logout} />;
};

export default AdminApp;
