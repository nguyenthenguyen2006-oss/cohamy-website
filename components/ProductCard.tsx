'use client';

import Image from 'next/image';
import {useLocale} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {Locale,Product} from '@/lib/types';
import {productImageDimensions} from '@/data/product-image-dimensions';
import {ProductPrice} from './ProductPrice';
import {ProductPurchase} from './ProductPurchase';
import {cartFont} from './cart-font';
import './product-purchase.css';

export function ProductCard({product}:{product:Product}) {
  const locale=useLocale() as Locale;
  const href={pathname:'/products/[slug]' as const,params:{slug:product.slug[locale]}};
  const dimensions=productImageDimensions[product.images[0]]??{width:900,height:675};
  return <article className={`cohamy-product-card ${cartFont.variable}`} data-product-card={product.id}>
    <div className="cohamy-product-card-media">
      <Link href={href} className="cohamy-product-card-photo" tabIndex={-1} aria-hidden="true">
        <Image src={product.images[0]} alt="" width={dimensions.width} height={dimensions.height} sizes="(max-width:640px) calc(100vw - 48px), (max-width:1280px) 45vw, 320px"/>
      </Link>
      <div className="cohamy-product-card-controls"><ProductPurchase product={product} compact/></div>
    </div>
    <div className="cohamy-product-card-info">
      <h3><Link href={href}>{product.name[locale]}</Link></h3>
      <ProductPrice productId={product.id} outOfStock={product.outOfStock} compact/>
    </div>
  </article>;
}
