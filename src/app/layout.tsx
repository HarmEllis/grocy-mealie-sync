import './globals.css';

export const metadata = {
  title: 'Grocy-Mealie Sync',
  description: 'Bi-directional sync between Grocy and Mealie',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
