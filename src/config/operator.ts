/** Public operator details supplied by deployment configuration. */

export type OperatorConfig = {
  creatorName: string;
  email: string;
  label: string;
  hasCreatorName: boolean;
  hasEmail: boolean;
};

const emailPattern =
  /^[A-Za-z0-9.!$&'*+/=`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
const placeholderEmail =
  /@(?:example\.(?:com|org|net)|test\.invalid)$|^(?:you|your|name|email|owner)@/i;

/**
 * PUBLIC_OPERATOR_* names are preferred; the older PUBLIC_CREATOR_NAME and
 * PUBLIC_CONTACT_EMAIL names keep working for existing deployments.
 */
export function resolveOperator(
  env: Record<string, string | undefined>
): OperatorConfig {
  const creatorName =
    (env.PUBLIC_OPERATOR_NAME ?? env.PUBLIC_CREATOR_NAME)
      ?.trim()
      .slice(0, 120) || "";
  const emailCandidate =
    (env.PUBLIC_OPERATOR_EMAIL ?? env.PUBLIC_CONTACT_EMAIL)?.trim() || "";
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

/**
 * AdSense review and ad serving require a reachable operator. Builds in
 * verify or serve mode stop when the public email is missing or a sample.
 */
export function assertOperatorForAds(
  adsenseMode: "off" | "verify" | "serve",
  operatorConfig: OperatorConfig
) {
  if (adsenseMode === "off") return;
  if (!operatorConfig.hasEmail || placeholderEmail.test(operatorConfig.email)) {
    throw new Error(
      "AdSense verify/serve builds require PUBLIC_OPERATOR_EMAIL (a real public contact address)"
    );
  }
}

export const operator = resolveOperator(import.meta.env ?? {});
