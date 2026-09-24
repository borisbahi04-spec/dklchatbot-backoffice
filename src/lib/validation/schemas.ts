import * as yup from "yup";
import { isValidJson } from "./validate";

/** Numéros de téléphone acceptés de façon permissive (chiffres, espaces, +, -, parenthèses). */
const PHONE_REGEX = /^[0-9+\-\s().]{6,20}$/;

export const loginSchema = yup.object({
  username: yup.string().trim().required("Le nom d'utilisateur est requis."),
  password: yup.string().required("Le mot de passe est requis."),
});

/**
 * `isEditing` : le mot de passe n'est obligatoire qu'à la création d'un
 * compte (en modification, un champ vide signifie "ne pas changer le mot de
 * passe" — voir `UserFormModal`).
 */
export function buildUserSchema(isEditing: boolean) {
  return yup.object({
    firstName: yup.string().trim(),
    lastName: yup.string().trim(),
    username: yup
      .string()
      .trim()
      .min(3, "3 caractères minimum.")
      .required("Le nom d'utilisateur est requis."),
    phoneNumber: yup
      .string()
      .trim()
      .matches(PHONE_REGEX, "Numéro de téléphone invalide.")
      .required("Le téléphone est requis."),
    email: yup.string().trim().email("Adresse email invalide.").optional(),
    branchId: yup.string().required("La succursale est requise."),
    roleId: yup.string().required("Le rôle est requis."),
    newPassword: isEditing
      ? yup.string().test(
          "min-if-present",
          "6 caractères minimum.",
          (value) => !value || value.length >= 6
        )
      : yup
          .string()
          .min(6, "6 caractères minimum.")
          .required("Le mot de passe est requis."),
  });
}

export const roleSchema = yup.object({
  name: yup.string().trim().required("Le code est requis."),
  displayName: yup.string().trim().required("Le nom affiché est requis."),
  description: yup.string().optional(),
});

export const accessSchema = yup.object({
  name: yup.string().trim().required("Le nom est requis."),
  entityJson: yup
    .string()
    .required("L'entité (JSON) est requise.")
    .test("valid-json", "JSON invalide.", isValidJson),
  permissionsJson: yup.string().test("valid-json", "JSON invalide.", isValidJson),
});

export const branchSchema = yup.object({
  code: yup.string().trim().required("Le code est requis."),
  displayName: yup.string().trim().required("Le nom est requis."),
  phoneNumber: yup
    .string()
    .trim()
    .matches(PHONE_REGEX, "Numéro de téléphone invalide.")
    .optional()
    .transform((v) => (v ? v : undefined)),
  email: yup
    .string()
    .trim()
    .email("Adresse email invalide.")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const settingSchema = yup.object({
  name: yup.string().trim().required("La clé est requise."),
  displayName: yup.string().trim().required("Le libellé est requis."),
  value: yup.string().required("La valeur est requise."),
});

export const erpConnectionSchema = yup.object({
  code: yup.string().trim().required("Le code est requis."),
  port: yup
    .number()
    .typeError("Le port doit être un nombre.")
    .integer("Le port doit être un entier.")
    .min(1, "Port invalide.")
    .max(65535, "Port invalide.")
    .required("Le port est requis."),
  baseUrl: yup.string().trim().required("La Base URL est requise."),
  apiUri: yup.string().trim().required("L'API URI est requise."),
  authUri: yup.string().trim().required("L'Auth URI est requise."),
  wsUri: yup.string().trim().required("Le WS URI est requis."),
  login: yup.string().trim().required("Le login est requis."),
  password: yup.string().required("Le mot de passe est requis."),
  branchId: yup.string().required("La succursale est requise."),
});
