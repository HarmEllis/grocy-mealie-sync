export const metadata = {
  title: 'Grocy-Mealie Sync',
  description: 'Bi-directional sync between Grocy and Mealie',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem', background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  );
}
