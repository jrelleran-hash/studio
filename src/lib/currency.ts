
import { CURRENCY_CONFIG } from "@/config/currency";

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    style: "currency",
    currency: CURRENCY_CONFIG.currency,
  }).format(amount);
}
