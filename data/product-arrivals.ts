import type { Product } from "@/lib/types";
import { productArrivalArticles } from "@/data/product-arrival-articles";

type ArrivalSeed = Pick<Product,
  "id" | "name" | "shortDescription" | "flavor" | "weight" | "tags" | "relatedProductIds"
> & { viSlug: string; imageCount: number };

function arrival({ viSlug, imageCount, ...product }: ArrivalSeed): Product {
  const article = productArrivalArticles[product.id];
  return {
    ...product,
    slug: { vi: viSlug, en: product.id, zh: product.id, ko: product.id, ja: product.id },
    description: {
      vi: product.shortDescription.vi + " Đóng túi " + product.weight + ".",
      en: product.shortDescription.en + " Packaged in a " + product.weight + " pouch.",
      zh: product.shortDescription.zh + "每袋净含量" + product.weight + "。",
      ko: product.shortDescription.ko + " " + product.weight + " 파우치 제품입니다.",
      ja: product.shortDescription.ja + "内容量" + product.weight + "のパウチ入りです。",
    },
    category: "pouch",
    article: { vi: article.html },
    price: null,
    images: [...Array.from({ length: imageCount }, (_, index) =>
      "/images/products/20261009/" + product.id + "/" + String(index + 1).padStart(2, "0") + ".jpg"
    ), "/images/products/20261009/" + product.id + "/label.jpg"],
    ingredients: {
      vi: article.ingredients,
      en: "Check the packaging or contact Cohamy for the full ingredients and allergen information.",
      zh: "完整配料及过敏原信息请查看包装或联系 Cohamy。",
      ko: "전체 원재료 및 알레르기 정보는 포장을 확인하거나 Cohamy에 문의하세요.",
      ja: "原材料とアレルギー情報はパッケージをご確認いただくか、Cohamyにお問い合わせください。",
    },
    storage: {
      vi: article.storage,
      en: "Follow the storage instructions on the packaging.",
      zh: "请按包装上的说明保存。",
      ko: "포장에 표시된 보관 방법을 따라 주세요.",
      ja: "パッケージに記載された保存方法に従ってください。",
    },
    tags: [...product.tags, "pouch", "premium", "new-arrival"],
    featured: true,
    newArrival: true,
  };
}

// Names, weights and coating types were transcribed from the supplied package photos.
export const productArrivals: Product[] = [
  arrival({
    "id": "cohamy-cashew-chocolate-80g",
    "viSlug": "cohamy-socola-hat-dieu-80g",
    "weight": "80g",
    "flavor": "cashew-chocolate",
    "imageCount": 10,
    "name": {
      "vi": "Cohamy Socola Hạt Điều 80g",
      "en": "Cohamy Cashew Chocolate 80g",
      "zh": "Cohamy 腰果巧克力 80g",
      "ko": "Cohamy 캐슈넛 초콜릿 80g",
      "ja": "Cohamy カシューナッツチョコレート 80g"
    },
    "shortDescription": {
      "vi": "Hạt điều phủ socola đen.",
      "en": "Cashews coated in dark chocolate.",
      "zh": "黑巧克力包裹腰果。",
      "ko": "다크 초콜릿으로 코팅한 캐슈넛.",
      "ja": "カシューナッツをダークチョコレートでコーティング。"
    },
    "tags": [
      "cashew",
      "dark-chocolate"
    ],
    "relatedProductIds": [
      "cohamy-almond-chocolate-80g",
      "cohamy-macadamia-chocolate-80g",
      "cohamy-cashew-chocolate"
    ]
  }),
  arrival({
    "id": "cohamy-almond-chocolate-80g",
    "viSlug": "cohamy-socola-hanh-nhan-80g",
    "weight": "80g",
    "flavor": "almond-chocolate",
    "imageCount": 9,
    "name": {
      "vi": "Cohamy Socola Hạnh Nhân 80g",
      "en": "Cohamy Almond Chocolate 80g",
      "zh": "Cohamy 杏仁巧克力 80g",
      "ko": "Cohamy 아몬드 초콜릿 80g",
      "ja": "Cohamy アーモンドチョコレート 80g"
    },
    "shortDescription": {
      "vi": "Hạnh nhân phủ socola đen.",
      "en": "Almonds coated in dark chocolate.",
      "zh": "黑巧克力包裹杏仁。",
      "ko": "다크 초콜릿으로 코팅한 아몬드.",
      "ja": "アーモンドをダークチョコレートでコーティング。"
    },
    "tags": [
      "almond",
      "dark-chocolate"
    ],
    "relatedProductIds": [
      "cohamy-almond-durian-chocolate-80g",
      "cohamy-almond-matcha-chocolate-80g",
      "cohamy-almond-chocolate"
    ]
  }),
  arrival({
    "id": "cohamy-almond-durian-chocolate-80g",
    "viSlug": "cohamy-socola-hanh-nhan-sau-rieng-80g",
    "weight": "80g",
    "flavor": "almond-durian",
    "imageCount": 10,
    "name": {
      "vi": "Cohamy Socola Hạnh Nhân Sầu Riêng 80g",
      "en": "Cohamy Almond Durian Chocolate 80g",
      "zh": "Cohamy 榴莲杏仁巧克力 80g",
      "ko": "Cohamy 두리안 아몬드 초콜릿 80g",
      "ja": "Cohamy ドリアンアーモンドチョコレート 80g"
    },
    "shortDescription": {
      "vi": "Hạnh nhân phủ socola vị sầu riêng.",
      "en": "Almonds coated in durian chocolate.",
      "zh": "榴莲味巧克力包裹杏仁。",
      "ko": "두리안 초콜릿으로 코팅한 아몬드.",
      "ja": "アーモンドをドリアン味のチョコレートでコーティング。"
    },
    "tags": [
      "almond",
      "durian"
    ],
    "relatedProductIds": [
      "cohamy-almond-strawberry-chocolate-80g",
      "cohamy-almond-matcha-chocolate-80g",
      "cohamy-almond-durian-chocolate"
    ]
  }),
  arrival({
    "id": "cohamy-mango-chocolate-80g",
    "viSlug": "cohamy-xoai-say-deo-phu-socola-80g",
    "weight": "80g",
    "flavor": "mango-chocolate",
    "imageCount": 9,
    "name": {
      "vi": "Cohamy Xoài Sấy Dẻo Phủ Socola 80g",
      "en": "Cohamy Dried Mango Chocolate 80g",
      "zh": "Cohamy 芒果干巧克力 80g",
      "ko": "Cohamy 건망고 초콜릿 80g",
      "ja": "Cohamy ドライマンゴーチョコレート 80g"
    },
    "shortDescription": {
      "vi": "Xoài sấy dẻo phủ socola đen.",
      "en": "Dried mango coated in dark chocolate.",
      "zh": "黑巧克力包裹芒果干。",
      "ko": "다크 초콜릿으로 코팅한 건망고.",
      "ja": "ドライマンゴーをダークチョコレートでコーティング。"
    },
    "tags": [
      "mango",
      "dried-fruit",
      "dark-chocolate"
    ],
    "relatedProductIds": [
      "cohamy-macadamia-chocolate-80g",
      "jamy-mango-dried-chocolate",
      "jamy-dried-mango"
    ]
  }),
  arrival({
    "id": "cohamy-macadamia-chocolate-80g",
    "viSlug": "cohamy-socola-mac-ca-80g",
    "weight": "80g",
    "flavor": "macadamia-chocolate",
    "imageCount": 10,
    "name": {
      "vi": "Cohamy Socola Mắc Ca 80g",
      "en": "Cohamy Macadamia Chocolate 80g",
      "zh": "Cohamy 夏威夷果巧克力 80g",
      "ko": "Cohamy 마카다미아 초콜릿 80g",
      "ja": "Cohamy マカダミアチョコレート 80g"
    },
    "shortDescription": {
      "vi": "Hạt mắc ca phủ socola đen.",
      "en": "Macadamia nuts coated in dark chocolate.",
      "zh": "黑巧克力包裹夏威夷果。",
      "ko": "다크 초콜릿으로 코팅한 마카다미아.",
      "ja": "マカダミアナッツをダークチョコレートでコーティング。"
    },
    "tags": [
      "macadamia",
      "dark-chocolate"
    ],
    "relatedProductIds": [
      "cohamy-cashew-chocolate-80g",
      "cohamy-almond-chocolate-80g",
      "jamy-macadamia-chocolate"
    ]
  }),
  arrival({
    "id": "cohamy-almond-strawberry-chocolate-80g",
    "viSlug": "cohamy-socola-hanh-nhan-dau-tay-80g",
    "weight": "80g",
    "flavor": "almond-strawberry",
    "imageCount": 10,
    "name": {
      "vi": "Cohamy Socola Hạnh Nhân Dâu Tây 80g",
      "en": "Cohamy Almond Strawberry Chocolate 80g",
      "zh": "Cohamy 草莓杏仁巧克力 80g",
      "ko": "Cohamy 딸기 아몬드 초콜릿 80g",
      "ja": "Cohamy ストロベリーアーモンドチョコレート 80g"
    },
    "shortDescription": {
      "vi": "Hạnh nhân phủ socola vị dâu tây.",
      "en": "Almonds coated in strawberry chocolate.",
      "zh": "草莓味巧克力包裹杏仁。",
      "ko": "딸기 초콜릿으로 코팅한 아몬드.",
      "ja": "アーモンドをストロベリー味のチョコレートでコーティング。"
    },
    "tags": [
      "almond",
      "strawberry"
    ],
    "relatedProductIds": [
      "cohamy-almond-matcha-chocolate-80g",
      "cohamy-almond-durian-chocolate-80g",
      "cohamy-almond-strawberry-chocolate"
    ]
  }),
  arrival({
    "id": "cohamy-almond-matcha-chocolate-80g",
    "viSlug": "cohamy-socola-hanh-nhan-matcha-80g",
    "weight": "80g",
    "flavor": "almond-matcha",
    "imageCount": 5,
    "name": {
      "vi": "Cohamy Socola Hạnh Nhân Matcha 80g",
      "en": "Cohamy Almond Matcha Chocolate 80g",
      "zh": "Cohamy 抹茶杏仁巧克力 80g",
      "ko": "Cohamy 말차 아몬드 초콜릿 80g",
      "ja": "Cohamy 抹茶アーモンドチョコレート 80g"
    },
    "shortDescription": {
      "vi": "Hạnh nhân phủ socola vị matcha.",
      "en": "Almonds coated in matcha chocolate.",
      "zh": "抹茶味巧克力包裹杏仁。",
      "ko": "말차 초콜릿으로 코팅한 아몬드.",
      "ja": "アーモンドを抹茶味のチョコレートでコーティング。"
    },
    "tags": [
      "almond",
      "matcha"
    ],
    "relatedProductIds": [
      "cohamy-almond-strawberry-chocolate-80g",
      "cohamy-almond-durian-chocolate-80g",
      "cohamy-almond-matcha-chocolate"
    ]
  }),
  arrival({
    "id": "cohamy-chocolate-candy-65g",
    "viSlug": "cohamy-socola-ngu-sac-65g",
    "weight": "65g",
    "flavor": "chocolate-candy",
    "imageCount": 10,
    "name": {
      "vi": "Cohamy Socola Ngũ Sắc 65g",
      "en": "Cohamy Colorful Chocolate Candy 65g",
      "zh": "Cohamy 彩色巧克力糖 65g",
      "ko": "Cohamy 컬러 초콜릿 캔디 65g",
      "ja": "Cohamy カラフルチョコレートキャンディ 65g"
    },
    "shortDescription": {
      "vi": "Kẹo socola nhiều màu trong túi hồng.",
      "en": "Colorful chocolate candy in a pink pouch.",
      "zh": "粉色袋装彩色巧克力糖。",
      "ko": "핑크색 파우치에 담긴 컬러 초콜릿 캔디.",
      "ja": "ピンクのパウチに入ったカラフルなチョコレートキャンディ。"
    },
    "tags": [
      "candy",
      "chocolate"
    ],
    "relatedProductIds": [
      "cohamy-almond-strawberry-chocolate-80g",
      "cohamy-almond-matcha-chocolate-80g",
      "cohamy-almond-chocolate-80g"
    ]
  }),
];
