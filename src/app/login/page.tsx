"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginSchema } from "@/lib/validation/schemas";
import { validateForm } from "@/lib/validation/validate";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const errors = await validateForm(loginSchema, { username, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login({ username, password });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Impossible de se connecter au serveur.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Bot className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Chatbot Back-office
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connectez-vous avec votre compte pour continuer.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <Input
            label="Nom d'utilisateur"
            name="username"
            autoComplete="username"
            required
            error={fieldErrors.username}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="Mot de passe"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            error={fieldErrors.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
