import type {Locale} from '@/lib/types';

const labels={
  vi:{title:'Giỏ hàng',suggestions:'Có thể bạn cũng thích',close:'Đóng giỏ hàng',open:'Mở giỏ hàng',remove:'Xóa',empty:'Giỏ hàng đang trống',continue:'Tiếp tục chọn sản phẩm',checkout:'Thanh toán',viewCart:'Xem giỏ hàng',added:'Đã thêm vào giỏ hàng',packages:'gói',shipping:'Lựa chọn giao hàng và phí vận chuyển được xác nhận khi xử lý yêu cầu đặt hàng.',vat:'Tiền hàng đã gồm VAT',unavailable:'Hiện chưa thể đặt sản phẩm này.',limit:'Tối đa 100 gói mỗi sản phẩm'},
  en:{title:'Your cart',suggestions:'You may also like',close:'Close cart',open:'Open cart',remove:'Remove',empty:'Your cart is empty',continue:'Continue shopping',checkout:'Checkout',viewCart:'View cart',added:'Added to cart',packages:'packs',shipping:'Delivery options and shipping fees are confirmed when your order request is reviewed.',vat:'Product total includes VAT',unavailable:'This product is currently unavailable.',limit:'Up to 100 packs per product'},
  zh:{title:'购物车',suggestions:'您可能也喜欢',close:'关闭购物车',open:'打开购物车',remove:'移除',empty:'购物车为空',continue:'继续购物',checkout:'结算',viewCart:'查看购物车',added:'已加入购物车',packages:'袋',shipping:'订单申请审核时确认配送方式及运费。',vat:'商品合计含增值税',unavailable:'此商品暂时无法订购。',limit:'每款商品最多100袋'},
  ko:{title:'장바구니',suggestions:'함께 살펴보세요',close:'장바구니 닫기',open:'장바구니 열기',remove:'삭제',empty:'장바구니가 비어 있습니다',continue:'계속 쇼핑하기',checkout:'결제하기',viewCart:'장바구니 보기',added:'장바구니에 담았습니다',packages:'팩',shipping:'배송 방법과 배송비는 주문 요청 검토 시 확정됩니다.',vat:'상품 합계에 부가세 포함',unavailable:'현재 주문할 수 없는 상품입니다.',limit:'상품당 최대 100팩'},
  ja:{title:'カート',suggestions:'こちらもおすすめ',close:'カートを閉じる',open:'カートを開く',remove:'削除',empty:'カートは空です',continue:'買い物を続ける',checkout:'購入手続き',viewCart:'カートを見る',added:'カートに追加しました',packages:'袋',shipping:'配送方法と送料は注文リクエストの確認時にご案内します。',vat:'商品合計はVAT込み',unavailable:'現在この商品は注文できません。',limit:'各商品100袋まで'},
} as const;

export function cartDrawerCopy(locale:Locale){return labels[locale];}
