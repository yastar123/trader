import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type AdminDeleteActionProps = {
  itemLabel: string;
  description?: string;
  disabled?: boolean;
  onDelete: () => Promise<boolean>;
};

export function AdminDeleteAction({
  itemLabel,
  description,
  disabled = false,
  onDelete,
}: AdminDeleteActionProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      if (await onDelete()) setOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!deleting) setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || deleting}
          aria-label={`Hapus ${itemLabel}`}
          className="h-8 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
          Hapus
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus data ini?</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? `Data ${itemLabel} akan dihapus permanen dan tidak dapat dipulihkan.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting ? "Menghapus..." : "Ya, hapus"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
