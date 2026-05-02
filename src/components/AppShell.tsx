import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [isSidebarCollapsed] = useState(false);
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/register');

  if (isAuth) return <>{children}</>;
  return (
    <div className="flex flex-col min-h-screen bg-background transition-all duration-300">
      <Topbar />
      <Sidebar isCollapsed={isSidebarCollapsed} />
      <div className={`flex-1 pt-16 transition-all duration-300 ${
        isSidebarCollapsed ? 'pl-20' : 'pl-64'
      }`}>
        <div className="max-w-7xl mx-auto p-6 pb-12">
          <div className="animate-fade-in-up">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
