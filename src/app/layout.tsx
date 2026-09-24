import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { StoreProvider } from "@/lib/store/StoreProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chatbot Back-office",
  description: "Console d'administration et chat pour chatbot-backend",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 font-sans dark:bg-slate-950">
        <StoreProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
