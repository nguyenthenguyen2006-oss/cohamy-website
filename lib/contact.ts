import type { Locale } from "@/lib/types";

export const CONTACT = {
  phone: "0981956111",
  phoneDisplay: "0981 956 111",
  zaloUrl: "https://zalo.me/0981956111",
  email: "Cohamyvietnam@gmail.com",
  emailMailto: "mailto:Cohamyvietnam@gmail.com",
  phoneTel: "tel:+84981956111",
  address: {
    vi: "Tầng 3, tháp A, Tòa T608, Tôn Quang Phiệt, phường Nghĩa Đô, Hà Nội",
    en: "Floor 3, Tower A, T608 Building, Ton Quang Phiet St., Nghia Do Ward, Hanoi, Vietnam",
    zh: "越南河内市义都坊通光斐街T608大厦A座3层",
    ko: "하노이 응이아 도 동, 톤 쿠앙 피엣 거리 T608 빌딩 A동 3층",
    ja: "ベトナム・ハノイ市義都坊トンクアンフィエット通りT608ビルA棟3階",
  } satisfies Record<Locale, string>,
  mapsLink:
    "https://www.google.com/maps/search/?api=1&query=Tòa+T608,+Tôn+Quang+Phiệt,+Nghĩa+Đô,+Hà+Nội,+Vietnam",
  mapsEmbedUrl:
    "https://www.google.com/maps?q=Tòa+T608,+Tôn+Quang+Phiệt,+phường+Nghĩa+Đô,+Hà+Nội,+Vietnam&hl=vi&z=17&output=embed",
} as const;

export function getAddress(locale: Locale): string {
  return CONTACT.address[locale];
}