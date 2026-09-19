/** Public operator details supplied by deployment configuration. */

export type OperatorConfig = {
  creatorName: string;
  email: string;
  label: string;
  hasCreatorName: boolean;
  hasEmail: boolean;
};

const emailPattern = /^[A-Za-z0-9.!$&'*+\/=\`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;

export function resolveOperator(env: Record<string, string | undefined>): OperatorConfig {
  const creatorName = env.PUBLIC_CREATOR_NAME?.trim().slice(0, 120) || "";
  const emailCandidate = env.PUBLIC_CONTACT_EMAIL?.trim() || "";
  const label = env.PUBLIC_CONTACT_LABEL?.trim().slice(0, 120) || "";
  const hasEmail = emailPattern.test(emailCandidate);

  return {
    creatorName,
    email: hasEmail ? emailCandidate : "",
    label,
    hasCreatorName: creatorName.length > 0,
    hasEmail,
  };
}

export const operator = resolveOperator(import.meta.env ?? {});
