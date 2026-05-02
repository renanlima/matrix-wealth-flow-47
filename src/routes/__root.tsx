import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Matrix Digital Assets" },
      { name: "description", content: "Plataforma de gestão de criptoativos em tempo real." },
      { name: "theme-color", content: "#0A0E1A" },
      { property: "og:title", content: "Matrix Digital Assets" },
      { name: "twitter:title", content: "Matrix Digital Assets" },
      { property: "og:description", content: "Plataforma de gestão de criptoativos em tempo real." },
      { name: "twitter:description", content: "Plataforma de gestão de criptoativos em tempo real." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c8cf20e7-6f75-4854-8f8b-154885c4c8bf/id-preview-4ec3221a--eeb72fad-93f8-4a73-ac2d-203186a820ce.lovable.app-1777744179392.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c8cf20e7-6f75-4854-8f8b-154885c4c8bf/id-preview-4ec3221a--eeb72fad-93f8-4a73-ac2d-203186a820ce.lovable.app-1777744179392.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/logo.png" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <Outlet />
        <Toaster richColors theme="dark" position="top-right" />
      </CurrencyProvider>
    </AuthProvider>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary text-glow font-mono">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 glow-cyan"
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
}
