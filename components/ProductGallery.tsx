"use client";

import { useState } from "react";
import Image from "next/image";
import {productImageDimensions} from '@/data/product-image-dimensions';

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const gallery = images.length ? images : ["/images/products/20261009/cohamy-almond-chocolate-80g/01.jpg"];
  const dimensions=productImageDimensions[gallery[active]]??{width:900,height:675};

  return (
    <div className="min-w-0 space-y-4">
      <Image
        src={gallery[active]}
        alt={alt}
        width={dimensions.width}
        height={dimensions.height}
        sizes="(max-width: 768px) calc(100vw - 48px), (max-width: 1200px) 50vw, 600px"
        priority
        className="rounded-3xl w-full h-auto"
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
