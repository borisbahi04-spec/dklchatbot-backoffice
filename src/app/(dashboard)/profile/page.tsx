"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { branchesApi } from "@/lib/resources";
import { ApiError } from "@/lib/api-client";
import type { Branch } from "@/lib/types";

export default function ProfilePage() {
  const { session, changePassword, switchBranch } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  useEffect(() => {
    branchesApi
      .listForSelect({ per_page: 100 })
      .then((res) => setBranches(res.data))
      .catch((err) => {
        setBranchesError(
          err instanceof ApiError ? err.message : "Impossible de charger les succursales."
        );
      });
  }, []);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setIsChangingPassword(true);
    try {
      await changePassword({ currentPassword, password, confirmPassword });
      toast.success("Mot de passe mis à jour.");
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSwitchBranch(e: FormEvent) {
    e.preventDefault();
    if (!targetBranchId) return;
    setIsSwitching(true);
    try {
      await switchBranch(targetBranchId);
      toast.success("Succursale changée.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSwitching(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Mon compte"
        description={`Connecté en tant que ${session?.username ?? ""}.`}
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <h2 className="font-medium text-slate-900 dark:text-white">Changer mon mot de passe</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <Input
                label="Mot de passe actuel"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                label="Nouveau mot de passe"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label="Confirmer le nouveau mot de passe"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Button type="submit" isLoading={isChangingPassword} className="self-start">
                Mettre à jour
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-medium text-slate-900 dark:text-white">Changer de succursale</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSwitchBranch} className="flex flex-col gap-4">
              {branchesError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {branchesError}
                </p>
              )}
              <Select
                label="Succursale cible"
                placeholder="Choisir une succursale"
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
              </Select>
              <Button type="submit" isLoading={isSwitching} className="self-start">
                Changer de succursale
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
