import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCE/RVV – Recherche juridique",
  description: "SaaS de recherche avancée dans les arrêts CCE/RVV",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
