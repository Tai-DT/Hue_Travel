import { TravelerCurrency } from '@/services/api';

export const CURRENCY_OPTIONS: Array<{
  code: TravelerCurrency;
  label: string;
  symbol: string;
  locale: string;
  rateFromVND: number;
}> = [
  { code: 'VND', label: 'VNĐ', symbol: '₫', locale: 'vi-VN', rateFromVND: 1 },
  { code: 'USD', label: 'USD', symbol: '$', locale: 'en-US', rateFromVND: 1 / 25300 },
  { code: 'EUR', label: 'EUR', symbol: '€', locale: 'de-DE', rateFromVND: 1 / 27600 },
];

function getCurrencyOption(currency: TravelerCurrency) {
  return CURRENCY_OPTIONS.find((item) => item.code === currency) || CURRENCY_OPTIONS[0];
}

export function formatCurrencyFromVND(amount: number, currency: TravelerCurrency) {
  const option = getCurrencyOption(currency);
  const converted = amount * option.rateFromVND;

  if (currency === 'VND') {
    return new Intl.NumberFormat(option.locale).format(Math.round(converted)) + option.symbol;
  }

  return new Intl.NumberFormat(option.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: converted >= 100 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(converted);
}

export function formatDiscountValue(amount: number, currency: TravelerCurrency) {
  return formatCurrencyFromVND(amount, currency);
}
