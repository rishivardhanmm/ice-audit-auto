import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quarterly Project Audit Agent",
  description: "Technical project audit dashboard for GitHub repositories."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </div>
      </body>
    </html>
  );
}
