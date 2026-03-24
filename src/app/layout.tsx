import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
  title: 'Grocy-Mealie Sync',
  description: 'Bi-directional sync between Grocy and Mealie',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <main>{children}</main>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
