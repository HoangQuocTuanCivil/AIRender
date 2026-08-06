/**
 * Print a composed prompt for a given axis triple. Used to feed the exact string
 * the UI would produce into an API call, so a manual test exercises the real
 * composition rather than a hand-written approximation.
 *
 *   npx tsx scripts/print-prompt.ts <subjectId> <contextId> <lightingId> [describe|instruct] [lanes]
 */
import { composePrompt, type PromptStyle } from "../src/lib/presets";

const [subject, context, lighting, style = "describe", lanes] =
  process.argv.slice(2);

if (!subject || !context || !lighting) {
  console.error(
    "usage: print-prompt.ts <subjectId> <contextId> <lightingId> [describe|instruct] [lanes]",
  );
  process.exit(2);
}

const out = composePrompt(
  subject,
  context,
  lighting,
  style as PromptStyle,
  "",
  lanes ? Number(lanes) : null,
);
if (!out) {
  console.error(`Unknown subject: ${subject}`);
  process.exit(1);
}
process.stdout.write(out);
