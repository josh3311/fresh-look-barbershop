import type { Photo } from "@/components/Portfolio";

// Checked by eye: all six are men's haircuts (cut-6 is a kids' cut collage).
export const menPhotos: Photo[] = [
  { src: "/images/men/cut-1.jpg", alt: "Curly top with skin fade and beard" },
  { src: "/images/men/cut-2.jpg", alt: "Short cut with low fade and beard" },
  { src: "/images/men/cut-3.jpg", alt: "High top with skin fade and full beard" },
  { src: "/images/men/cut-4.jpg", alt: "Curly top with taper fade" },
  { src: "/images/men/cut-5.jpg", alt: "Textured crop with mid fade and beard" },
  { src: "/images/men/cut-6.jpg", alt: "Kids' cuts with line-up and part" },
];

// Women's style photos go in /public/images/women/ (TODO: stylist's originals).
export const womenPhotos: Photo[] = [];
