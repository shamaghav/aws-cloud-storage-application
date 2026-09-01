import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudStore — AWS Cloud File Storage",
  description: "Secure, scalable cloud file storage powered by Amazon S3, IAM, and CloudWatch.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
