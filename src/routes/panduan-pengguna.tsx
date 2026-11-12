import { createFileRoute } from "@tanstack/react-router";
import { PanduanPenggunaView } from "@/components/workspace/panduan-pengguna-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Panduan Pengguna | IC Trading";
const pageDescription = "Panduan penggunaan platform, daftar periksa pemula, dan tanya jawab.";

export const Route = createFileRoute("/panduan-pengguna")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: PanduanPenggunaPage,
});

function PanduanPenggunaPage() {
  return (
    <WorkspaceShell title="Panduan Pengguna" subtitle="Dokumentasi fitur dan pertanyaan umum">
      <PanduanPenggunaView />
    </WorkspaceShell>
  );
}
