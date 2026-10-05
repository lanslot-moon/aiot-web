import { useEffect, type ReactNode } from 'react';
import logo from '@/assets/images/logos/logoicon.svg';
import { AuthCube } from './auth-cube';
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · AIoT`;
  }, [title]);
  return (
    <main className="flex min-h-dvh items-stretch bg-background">
      <aside className="relative hidden w-lg shrink-0 flex-col items-center justify-center overflow-hidden bg-black p-16 text-center text-white lg:flex">
        <div className="relative z-10 max-w-sm space-y-6">
          <AuthCube />
          <img src={logo} alt="" className="mx-auto size-10" />
        </div>
      </aside>
      <section className="flex flex-1 items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-md space-y-6">
          <img src={logo} alt="AIoT" className="mx-auto size-10 dark:hidden" />
          <img src={logo} alt="AIoT" className="mx-auto hidden size-10 dark:block" />
          <header className="space-y-1 text-center">
            <h1 className="text-2xl font-medium">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </header>
          {children}
        </div>
      </section>
    </main>
  );
}
