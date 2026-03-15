import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Huế Travel — Admin Dashboard',
  description: 'Quản trị hệ thống Huế Travel',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
