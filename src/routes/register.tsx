import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/auth/account-page";

const pageTitle = "Daftar akun wmTrader";
const pageDescription = "Halaman pendaftaran akun wmTrader.";

export const Route = createFileRoute("/register")({
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
  component: RegisterPage,
});

function RegisterPage() {
  return <AccountPage mode="register" />;
}
