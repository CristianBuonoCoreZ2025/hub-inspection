import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claims Hub",
  description: "App de inspecciones offline",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
