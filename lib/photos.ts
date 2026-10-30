import type { Photo } from "@/components/Portfolio";

// Men's wall (Home + /men): the 2 kept originals, then the 4 new photos (change request #1).
export const menPhotos: Photo[] = [
  { src: "/images/men/cut-1.jpg", alt: "Curly top with skin fade and beard" },
  { src: "/images/men/cut-2.jpg", alt: "Short cut with low fade and beard" },
  { src: "/images/men/men-cornrows.jpg", alt: "Man with cornrows and a skin fade", position: "20% center" },
  { src: "/images/men/men-fade-textured.jpg", alt: "Textured top with a low fade and light beard" },
  { src: "/images/men/men-box-braids.jpg", alt: "Man with box braids and a fade" },
  { src: "/images/men/men-undercut-beard.jpg", alt: "Brushed-up top with a high fade and full beard" },
];

// Women's wall (Home, under the men's wall).
export const womenPhotos: Photo[] = [
  { src: "/images/women/women-knotless-red.jpg", alt: "Long red-brown knotless braids" },
  { src: "/images/women/women-fulani-curls.jpg", alt: "Fulani cornrows with a top bun and long curly ends" },
  { src: "/images/women/women-boho-curls.jpg", alt: "Boho knotless braids with caramel curly ends" },
  { src: "/images/women/women-box-braids.jpg", alt: "Large box braids with gold cuffs" },
];
