export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export function getProductImageUrl(imageUrl?: string | null): string {
  const source = imageUrl?.trim().replace(/\\/g, "/");
  if (!source) return "";

  if (/^(?:https?:)?\/\//i.test(source) || /^[a-z][a-z\d+.-]*:/i.test(source)) {
    return source;
  }

  return `${API_BASE_URL}/${source.replace(/^\/+/, "")}`;
}

export function getProductImages(product: {
  image_url?: string | null;
  images?: (string | null | undefined)[] | null;
}): string[] {
  return [
    ...new Set(
      [product.image_url, ...(product.images ?? [])]
        .map((image) => getProductImageUrl(image))
        .filter(Boolean)
    ),
  ];
}
