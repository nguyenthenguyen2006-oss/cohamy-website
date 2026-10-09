"use client";

import { useState } from "react";
import Image from "next/image";

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const gallery = images.length ? images : ["/images/products/cohamy-almond-chocolate-55g.jpg"];

  return (
    <div className="min-w-0 space-y-4">
      <Image
        src={gallery[active]}
        alt={alt}
        width={900}
        height={900}
        priority
        className="rounded-3xl w-full aspect-square object-contain bg-white"
      />
      {gallery.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {gallery.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${alt} (${index + 1}/${gallery.length})`}
              aria-pressed={active === index}
              className={`shrink-0 rounded-xl overflow-hidden border-2 ${
                active === index ? "border-[#D9A441]" : "border-transparent"
              }`}
            >
              <Image
                src={image}
                alt=""
                width={64}
                height={64}
                className="w-16 h-16 object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
