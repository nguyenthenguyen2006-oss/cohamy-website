"use client";

import { useState } from "react";

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const gallery = images.length ? images : ["/images/products/cohamy-almond-chocolate-55g.jpg"];

  return (
    <div className="space-y-4">
      <img
        src={gallery[active]}
        alt={alt}
        className="rounded-3xl w-full aspect-square object-cover"
      />
      {gallery.length > 1 && (
        <div className="flex gap-3">
          {gallery.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              className={`rounded-xl overflow-hidden border-2 ${
                active === index ? "border-[#D9A441]" : "border-transparent"
              }`}
            >
              <img src={image} alt="" className="w-16 h-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}