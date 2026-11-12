import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/auth/account-page";

const pageTitle = "Masuk ke akun IC Trading";
const pageDescription = "Halaman masuk akun IC Trading.";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return <AccountPage mode="login" />;
}
