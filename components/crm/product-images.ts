const skuImageMap:Record<string,string>={
  'WEB-cohamy-almond-chocolate':'/images/products/20261009/cohamy-almond-chocolate-80g/01.jpg',
  'WEB-cohamy-almond-durian-chocolate':'/images/products/20261009/cohamy-almond-durian-chocolate-80g/01.jpg',
  'WEB-cohamy-almond-matcha-chocolate':'/images/products/20261009/cohamy-almond-matcha-chocolate-80g/01.jpg',
  'WEB-cohamy-almond-strawberry-chocolate':'/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/01.jpg',
  'WEB-cohamy-cashew-chocolate':'/images/products/20261009/cohamy-cashew-chocolate-80g/01.jpg',
  'WEB-cohamy-rainbow-chocolate':'/images/products/20261009/cohamy-chocolate-candy-65g/01.jpg',
  'WEB-jamy-macadamia-chocolate':'/images/products/20261009/cohamy-macadamia-chocolate-80g/01.jpg',
  'WEB-jamy-mango-dried-chocolate':'/images/products/20261009/cohamy-mango-chocolate-80g/01.jpg',
  'cohamy-almond-chocolate-80g':'/images/products/20261009/cohamy-almond-chocolate-80g/01.jpg',
  'cohamy-almond-durian-chocolate-80g':'/images/products/20261009/cohamy-almond-durian-chocolate-80g/01.jpg',
  'cohamy-almond-matcha-chocolate-80g':'/images/products/20261009/cohamy-almond-matcha-chocolate-80g/01.jpg',
  'cohamy-almond-strawberry-chocolate-80g':'/images/products/20261009/cohamy-almond-strawberry-chocolate-80g/01.jpg',
  'cohamy-cashew-chocolate-80g':'/images/products/20261009/cohamy-cashew-chocolate-80g/01.jpg',
  'cohamy-chocolate-candy-65g':'/images/products/20261009/cohamy-chocolate-candy-65g/01.jpg',
  'cohamy-macadamia-chocolate-80g':'/images/products/20261009/cohamy-macadamia-chocolate-80g/01.jpg',
  'cohamy-mango-chocolate-80g':'/images/products/20261009/cohamy-mango-chocolate-80g/01.jpg',
};
export function resolveProductImage(sku:string,productImage?:string){
  if(skuImageMap[sku])return skuImageMap[sku];
  if(productImage&&!productImage.includes('-55g.')&&!productImage.includes('-150g.')&&!productImage.includes('-160g.'))return productImage;
  return '/images/logo/cohamy-c-gold.png';
}
