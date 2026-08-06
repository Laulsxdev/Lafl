import type { Metadata, Viewport } from "next";
import "./globals.css";
import FormPending from "@/components/form-pending";

export const metadata: Metadata = {
  title: "Lafl TMS",
  description: "Vehicle Transportation Management System",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Lafl TMS" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // let the app paint under the iPhone notch/home indicator; pages pad with env(safe-area-inset-*)
  viewportFit: "cover",
  themeColor: "#ffffff",
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
