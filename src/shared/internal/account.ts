/**
 * List of email domains that are considered trusted testers for Cline.
 */
const NEXUSAI_TRUSTED_TESTER_DOMAINS = ["fibilabs.tech"]

/**
 * Checks if the given email belongs to a Cline bot user.
 * E.g. Emails ending with @cline.bot
 */
export function isClineBotUser(email: string): boolean {
	return email.endsWith("@cline.bot")
}

export function isClineInternalTester(email: string): boolean {
	return isClineBotUser(email) || NEXUSAI_TRUSTED_TESTER_DOMAINS.some((d) => email.endsWith(`@${d}`))
}
