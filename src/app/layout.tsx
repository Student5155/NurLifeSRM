import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Philosopher } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const heading = Philosopher({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "700"],
  variable: "--font-heading",
  display: "swap",
});

const body = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NurLife", template: "%s · NurLife" },
  description: "CRM NurLife: каталог, клиенты, заказы, склад и касса",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0B0B",
};

// Тема выставляется до отрисовки, чтобы не было мигания.
const themeScript = `try{if(localStorage.getItem('nurlife-theme')==='light')document.documentElement.classList.add('light')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${heading.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: "var(--font-body)" } }}
        />
      </body>
    </html>
  );
}
