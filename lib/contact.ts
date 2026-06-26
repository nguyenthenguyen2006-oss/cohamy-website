import type { Locale } from "@/lib/types";

export const CONTACT = {
  phone: "0981956111",
  phoneDisplay: "0981 956 111",
  zaloUrl: "https://zalo.me/0981956111",
  email: "Cohamyvietnam@gmail.com",
  emailMailto: "mailto:Cohamyvietnam@gmail.com",
  phoneTel: "tel:+84981956111",
  companyName: {
    vi: "CÔNG TY TNHH COHAMY",
    en: "COHAMY COMPANY LIMITED",
    zh: "COHAMY有限责任公司",
    ko: "COHAMY 유한책임회사",
    ja: "COHAMY有限責任会社",
  } satisfies Record<Locale, string>,
  addresses: {
    hanoi: {
      vi: "Tầng 3, tháp A, Tòa T608, Phường Nghĩa Đô, TP. Hà Nội",
      en: "Floor 3, Tower A, T608 Building, Nghia Do Ward, Hanoi, Vietnam",
      zh: "越南河内市义都坊T608大厦A座3层",
      ko: "하노이 응이아 도 동 T608 빌딩 A동 3층",
      ja: "ベトナム・ハノイ市義都坊T608ビルA棟3階",
    },
    hcmc: {
      vi: "Tổ 7, Cầu Mới, P. Tân Thành, TP Hồ Chí Minh",
      en: "Group 7, Cau Moi, Tan Thanh Ward, Ho Chi Minh City, Vietnam",
      zh: "越南胡志明市新成坊新桥7组",
      ko: "호치민시 탄타인 동 카우모이 7반",
      ja: "ベトナム・ホーチミン市タンタイン坊カウモイ7組",
    },
  } satisfies Record<"hanoi" | "hcmc", Record<Locale, string>>,
  mapsLink:
    "https://www.google.com/maps/search/?api=1&query=Tòa+T608,+Phường+Nghĩa+Đô,+Hà+Nội,+Vietnam",
  mapsEmbedUrl:
    "https://www.google.com/maps?q=Tòa+T608,+Phường+Nghĩa+Đô,+Hà+Nội,+Vietnam&hl=vi&z=17&output=embed",
  mapsLinkHcmc:
    "https://www.google.com/maps/search/?api=1&query=Tổ+7,+Cầu+Mới,+Tân+Thành,+Hồ+Chí+Minh,+Vietnam",
} as const;

export function getCompanyName(locale: Locale): string {
  return CONTACT.companyName[locale];
}

export function getAddress(locale: Locale, office: "hanoi" | "hcmc" = "hanoi"): string {
  return CONTACT.addresses[office][locale];
}

export function getAddresses(locale: Locale): { hanoi: string; hcmc: string } {
  return {
    hanoi: CONTACT.addresses.hanoi[locale],
    hcmc: CONTACT.addresses.hcmc[locale],
  };
}