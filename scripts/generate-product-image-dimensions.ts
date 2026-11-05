import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {products} from '../data/products';

async function main() {
  const dimensions:Record<string,{width:number;height:number}>={};
  for(const image of [...new Set(products.flatMap(product=>product.images))].sort()) {
    if(!image.startsWith('/images/'))throw new Error('LOCAL_PRODUCT_IMAGE_REQUIRED');
    const metadata=await sharp(path.join('public',image)).metadata();
    if(!metadata.width||!metadata.height)throw new Error('PRODUCT_IMAGE_DIMENSIONS_MISSING');
    dimensions[image]={width:metadata.width,height:metadata.height};
  }
  const source='// Generated from the original public product images. Run scripts/generate-product-image-dimensions.ts after changing assets.\nexport const productImageDimensions: Record<string, {width:number;height:number}> = '+JSON.stringify(dimensions,null,2)+';\n';
  await fs.writeFile('data/product-image-dimensions.ts',source);
  console.log(JSON.stringify({images:Object.keys(dimensions).length,status:'GENERATED'}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'IMAGE_DIMENSIONS_FAILED');process.exitCode=1;});
