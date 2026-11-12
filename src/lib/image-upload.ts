export async function readImageFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar (PNG, JPG, JPEG, atau WebP).");
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error("Ukuran file gambar maksimal 6 MB.");
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca file gambar."));
    };
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.readAsDataURL(file);
  });

  // Kompres ringan jika dimensi besar agar pengunggahan cepat dan tajam
  if (typeof Image === "undefined" || typeof document === "undefined") {
    return rawDataUrl;
  }

  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 1280;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(outputType, 0.85));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}
