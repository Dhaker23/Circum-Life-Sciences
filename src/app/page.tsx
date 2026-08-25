import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// Root "/" redirects to the default locale. next-intl middleware handles this,
// but an explicit fallback ensures correctness.
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
