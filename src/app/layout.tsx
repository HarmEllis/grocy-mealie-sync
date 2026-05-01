import './globals.css';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ThemeScript } from '@/components/theme/ThemeScript';
import { AppShell } from '@/components/layout/AppShell';
import { getAuthConfig } from '@/lib/auth';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Grocy-Mealie Sync',
  description: 'Bi-directional sync between Grocy and Mealie',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = getAuthConfig().enabled;

  return (
    <html
      lang="en"
      className={cn('font-sans antialiased', plusJakartaSans.variable, jetBrainsMono.variable)}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <AppShell authEnabled={authEnabled}>{children}</AppShell>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
