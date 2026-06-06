export interface CurrencyInfo {
  code:   string;
  symbol: string;
  name:   string;
}

const COUNTRY_CURRENCY: Record<string, CurrencyInfo> = {
  // GBP
  'United Kingdom': { code: 'GBP', symbol: '£', name: 'British Pound' },

  // USD
  'United States':  { code: 'USD', symbol: '$', name: 'US Dollar' },
  'Ecuador':        { code: 'USD', symbol: '$', name: 'US Dollar' },
  'El Salvador':    { code: 'USD', symbol: '$', name: 'US Dollar' },
  'Panama':         { code: 'USD', symbol: '$', name: 'US Dollar' },

  // EUR
  'Germany':        { code: 'EUR', symbol: '€', name: 'Euro' },
  'France':         { code: 'EUR', symbol: '€', name: 'Euro' },
  'Spain':          { code: 'EUR', symbol: '€', name: 'Euro' },
  'Italy':          { code: 'EUR', symbol: '€', name: 'Euro' },
  'Netherlands':    { code: 'EUR', symbol: '€', name: 'Euro' },
  'Belgium':        { code: 'EUR', symbol: '€', name: 'Euro' },
  'Portugal':       { code: 'EUR', symbol: '€', name: 'Euro' },
  'Austria':        { code: 'EUR', symbol: '€', name: 'Euro' },
  'Ireland':        { code: 'EUR', symbol: '€', name: 'Euro' },
  'Finland':        { code: 'EUR', symbol: '€', name: 'Euro' },
  'Greece':         { code: 'EUR', symbol: '€', name: 'Euro' },
  'Luxembourg':     { code: 'EUR', symbol: '€', name: 'Euro' },
  'Malta':          { code: 'EUR', symbol: '€', name: 'Euro' },
  'Cyprus':         { code: 'EUR', symbol: '€', name: 'Euro' },
  'Slovakia':       { code: 'EUR', symbol: '€', name: 'Euro' },
  'Slovenia':       { code: 'EUR', symbol: '€', name: 'Euro' },
  'Estonia':        { code: 'EUR', symbol: '€', name: 'Euro' },
  'Latvia':         { code: 'EUR', symbol: '€', name: 'Euro' },
  'Lithuania':      { code: 'EUR', symbol: '€', name: 'Euro' },
  'Croatia':        { code: 'EUR', symbol: '€', name: 'Euro' },

  // CAD
  'Canada':         { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },

  // AUD
  'Australia':      { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  'New Zealand':    { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },

  // Scandinavian
  'Norway':         { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  'Sweden':         { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  'Denmark':        { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  'Iceland':        { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna' },

  // CHF
  'Switzerland':    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },

  // Other
  'Japan':          { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  'South Korea':    { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  'China':          { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  'India':          { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  'Brazil':         { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  'Mexico':         { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  'South Africa':   { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  'Nigeria':        { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  'Ghana':          { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  'Kenya':          { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  'United Arab Emirates': { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  'Saudi Arabia':   { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  'Singapore':      { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  'Malaysia':       { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  'Pakistan':       { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  'Bangladesh':     { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  'Turkey':         { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  'Poland':         { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  'Czech Republic': { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  'Hungary':        { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  'Romania':        { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
};

const DEFAULT: CurrencyInfo = { code: 'USD', symbol: '$', name: 'US Dollar' };

export function getCurrencyForCountry(countryName: string): CurrencyInfo {
  return COUNTRY_CURRENCY[countryName] ?? DEFAULT;
}

// Extract country from "City, Country" location string
export function extractCountry(location: string): string {
  const parts = location.split(',');
  return parts[parts.length - 1]?.trim() ?? '';
}

const CODE_TO_SYMBOL: Record<string, string> = {};
for (const info of Object.values(COUNTRY_CURRENCY)) {
  CODE_TO_SYMBOL[info.code] = info.symbol;
}

export function getCurrencySymbol(code: string): string {
  return CODE_TO_SYMBOL[code] ?? code;
}
