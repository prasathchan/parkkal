import Link from "next/link";

interface HeaderProps {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
  user?: { name: string; role: string };
}

export function Header({ title, breadcrumb, user }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 mt-0.5">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-400 text-xs" aria-hidden="true">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-xs text-slate-500" aria-current={i === breadcrumb.length - 1 ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>
      {user && (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.role}</p>
          </div>
        </div>
      )}
    </header>
  );
}
