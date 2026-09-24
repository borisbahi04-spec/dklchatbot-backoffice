import * as yup from "yup";

/**
 * Valide `values` contre un schéma Yup et renvoie une map `{ champ: message }`
 * exploitable directement par la prop `error` des composants de
 * `components/ui/Input.tsx` (Input / Select / Textarea) — un objet vide
 * signifie "formulaire valide". N'utilise pas react-hook-form : ce template
 * garde des formulaires en état contrôlé simple (`useState`), donc la
 * validation se fait explicitement au clic sur "Enregistrer" plutôt qu'au
 * fil de la frappe.
 */
export async function validateForm<T extends object>(
  schema: yup.Schema,
  values: T
): Promise<Record<string, string>> {
  try {
    await schema.validate(values, { abortEarly: false });
    return {};
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      const errors: Record<string, string> = {};
      for (const inner of err.inner.length ? err.inner : [err]) {
        if (inner.path && !(inner.path in errors)) {
          errors[inner.path] = inner.message;
        }
      }
      return errors;
    }
    throw err;
  }
}

/** true si un texte est un JSON valide (objet ou tableau) — utilisé par le formulaire "Accès". */
export function isValidJson(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
