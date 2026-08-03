import type { Metadata } from "next";
import "./globals.css";
import FormPending from "@/components/form-pending";

export const metadata: Metadata = {
  title: "Lafl TMS",
  description: "Vehicle Transportation Management System",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <FormPending />
        {children}
      </body>
    </html>
  );
}
