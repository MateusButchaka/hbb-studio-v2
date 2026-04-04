import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Wand2, Users, Image, Clapperboard, Briefcase } from 'lucide-react';

const agencyItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clientes', icon: Users },
  { to: '/gallery', label: 'Galeria', icon: Image },
];

const factoryItems = [
  { to: '/lookbook', label: 'Criar Lookbook', icon: Clapperboard },
  { to: '/create', label: 'Criar Arte IA', icon: Wand2 },
];

function NavSection({ title, icon: SectionIcon, items }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-4 mb-2 mt-2">
        <SectionIcon size={13} className="text-gray-500" />
        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">{title}</p>
      </div>
      <div className="space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-primary font-sans">
      {/* Sidebar */}
      <aside className="w-60 fixed top-0 left-0 h-full bg-secondary flex flex-col border-r border-white/5 z-10">
        {/* Logo */}
        <div className="px-6 py-7 border-b border-white/5">
          <h1 className="text-gold font-bold text-xl tracking-widest uppercase">HBB Studio</h1>
          <p className="text-gray-500 text-xs mt-1">v2 — Marketing Automation</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 overflow-y-auto">
          <NavSection title="Gestão de Agência" icon={Briefcase} items={agencyItems} />
          <div className="border-t border-white/5 my-2" />
          <NavSection title="TikTok Content Factory" icon={Clapperboard} items={factoryItems} />
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-white/5">
          <p className="text-gray-600 text-xs">© 2024 HBB Studio</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen bg-primary">
        <Outlet />
      </main>
    </div>
  );
}
